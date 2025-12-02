"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon } from 'lucide-react';
import { useForm } from "react-hook-form"
import { firebaseClient } from "@/lib/firebase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "sonner"
import { Loader2, CheckCircle} from "lucide-react"

interface AccessCode {
  id: string;
  document_id: string;
  status: "paid" | "used" | "pending";
  is_group: boolean;
  people_count: number;
  assigned_to_group?: boolean;
}

interface Registration {
  id: string;
  document_id: string;
  full_name: string;
  phone: string;
  rh: string;
  route_id_day1?: string;
  route_id_day2?: string;
  access_code: string;
  group_id?: string;
  payment_status: "paid" | "pending";
  registration_type: "group_leader" | "group_member" | "individual";
  created_at: string;
  updated_at?: string;
  document_type: string;
  group_name?: string;
  leader_full_name?: string;
}

type Route = {
  id: string
  name: string
  available_spots_by_day: { day: number; spots: number }[]
}
const walkerSchema = z.object({
  id: z.string().optional(), // Esto podría ser útil si manejas IDs para walkers existentes
  full_name: z.string().min(3, "El nombre completo del caminante es requerido"),
  document_id: z.string().min(5, "El número de documento del caminante es requerido"),
  document_type: z.string().optional(), // Puedes hacerlo requerido si aplica
  phone: z.string().min(7, "El teléfono del caminante es requerido").optional(), // Puedes hacerlo requerido si aplica
  rh: z.string().min(1, "El RH del caminante es requerido").optional(), // Puedes hacerlo requerido si aplica
  // No incluyas route_id_day1 o route_id_day2 aquí si se heredan del líder/grupo
})
// Schema de validación del formulario
const inscriptionSchema = z.object({
  document_id: z.string().min(5, "El número de documento es requerido"),
  confirmation_code: z.string().min(3, "El código de confirmación es requerido"),
  full_name: z.string().min(3, "El nombre completo es requerido").optional(),
  phone: z.string().min(7, "El teléfono es requerido").optional(),
  rh: z.string().min(1, "El RH es requerido").optional(),
  route_id_day1: z.string().optional(),
  route_id_day2: z.string().optional(),
  group_name: z.string().min(3, "El nombre del grupo es requerido").optional(),
  leader_full_name: z.string().min(3, "El nombre completo es requerido").optional(),
  document_type: z.string().min(2, "El tipo de documento es requerido"),
  walkers: z.array(walkerSchema).optional(),
})



export default function InscripcionPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(false)
  //const [loadingRoutes, setLoadingRoutes] = useState(true)
  const [verificationStep, setVerificationStep] = useState<"verify" | "individual" | "group_leader" | "success">("verify")
  const [verifiedAccessCode, setVerifiedAccessCode] = useState<any>(null)
  //const [walkers, setWalkers] = useState<{ full_name: string; document_id: string; rh: string; phone: string }[]>([])
  const router = useRouter()

  const form = useForm<z.infer<typeof inscriptionSchema>>({
    resolver: zodResolver(inscriptionSchema),
    defaultValues: {
      document_id: "",
      confirmation_code: "",
      full_name: "",
      phone: "",
      rh: "",
      route_id_day1: "",
      route_id_day2: "",
      group_name: "",
      leader_full_name: "",
      //walkers: []
    },
  })

  

  // Cargar rutas con cupos disponibles
  useEffect(() => {
    fetchRoutes()
  }, [])

  const fetchRoutes = async () => {
  try {
    const routesData = await firebaseClient.getRoutes()
    const routesWithAvailability = await Promise.all(
      routesData.map(async (route) => {
        const availableSpotsTemplate = route.available_spots_by_day || []
        const registeredByDay = await firebaseClient.getAvailableSpotsByRoute(route.id)

        // Calcular cupos disponibles por día
        const availableSpotsByDay = availableSpotsTemplate
          .map((daySpot: { day: number; spots: number }) => ({
            day: daySpot.day,
            spots: Math.max(0, daySpot.spots - (registeredByDay[daySpot.day] || 0)),
          }))
          .filter((daySpot) => daySpot.spots > 0) // Solo días con cupos

        // Si no hay días con cupos, no incluir la ruta
        if (availableSpotsByDay.length === 0) return null

        return {
          ...route,
          available_spots_by_day: availableSpotsByDay,
        }
      }),
    )

    // Filtrar rutas nulas (sin cupos)
    const validRoutes = routesWithAvailability.filter((route) => route !== null)
    setRoutes(validRoutes)
  } catch (error) {
    console.error("Error fetching routes:", error)
    toast.error("Error al cargar las rutas")
  }
}

  // Verificar código de acceso
  const handleVerification = async () => {
    const documentId = form.getValues("document_id")
    const confirmationCode = form.getValues("confirmation_code")
    
    if (!documentId || !confirmationCode) {
      toast.error("Por favor completa todos los campos")
      return
    }
  
    setLoading(true)
    try {
      const accessCode: AccessCode | null = await firebaseClient.getAccessCodeByCode(confirmationCode)
  
      if (
        accessCode &&
        accessCode.document_id === documentId &&
        (accessCode.status === "paid" || accessCode.status === "used")
      ) {
        setVerifiedAccessCode(accessCode)
        
  
        // Buscar inscripción existente
        const existingRegistration = await firebaseClient.getRegistrationByDocument(documentId)
  
        if (existingRegistration) {
          console.log("Registro existente encontrado:", existingRegistration)
          // Si existe, precargar datos
          
          form.reset({
            document_id: existingRegistration.document_id,
            document_type: existingRegistration.document_type || "cedula",
            confirmation_code: confirmationCode,
            full_name: existingRegistration.full_name,
            phone: existingRegistration.phone,
            rh: existingRegistration.rh,
            route_id_day1: existingRegistration.route_id_day1 || "",
            route_id_day2: existingRegistration.route_id_day2 || "",
            group_name: existingRegistration.group_name || "",
            leader_full_name: existingRegistration.leader_full_name || "",
          })
          console.log("Verificando código:"+ accessCode.is_group +" y tipo es "+ existingRegistration.registration_type)
          // Mostrar tabla o formulario según tipo
          if (accessCode.is_group && existingRegistration.document_id === documentId) {
            setVerificationStep("group_leader")
            toast.info("Este grupo ya fue registrado. Puedes actualizar la información.")
            router.push(`/grupo/${existingRegistration.group_id}`)
          } else if (!accessCode.is_group && existingRegistration.document_id === documentId) {
            setVerificationStep("individual")
            
            toast.info("Esta persona ya está registrada. Puedes actualizar tu información.")
          }
        } else {
          console.log("No existe el registro");
          // Es nuevo o no tiene registro aún
          setVerificationStep(accessCode.is_group ? "group_leader" : "individual")
          toast.success("Código verificado correctamente")
        }
      } else if (accessCode && accessCode.document_id !== documentId) {
        toast.error("El número de documento no coincide con el código")
      } else if (accessCode && accessCode.status !== "paid" && accessCode.status !== "used") {
        toast.error("El código no tiene un pago confirmado")
      } else {
        toast.error("Código de confirmación inválido o no encontrado")
      }
    } catch (error) {
      console.error("Error verifying access code:", error)
      toast.error("Error al verificar el código")
    } finally {
      setLoading(false)
    }
  }
  const handleSaveLeader = async (data: z.infer<typeof inscriptionSchema>) => {
    setLoading(true)
    try {
      // Validar campos obligatorios
      if (!data.leader_full_name || !data.phone || !data.rh || !data.group_name || !data.document_type) {
        toast.error("Todos los campos son requeridos")
        return
      }
  
      // 1. Guardar grupo
      const newGroup = await firebaseClient.createGroup({
        group_name: data.group_name,
        leader_document_id: data.document_id,
        member_count: verifiedAccessCode.people_count,
      })
  
      // 2. Guardar inscripción del líder con el nuevo campo `group_id`
      const registrationData = {
        document_id: data.document_id,
        full_name: data.leader_full_name,
        phone: data.phone,
        rh: data.rh,
        route_id_day1: data.route_id_day1,
        route_id_day2: data.route_id_day2,
        access_code: data.confirmation_code,
        group_id: newGroup.id, // Aquí se guarda el ID del grupo
        payment_status: "paid",
        registration_type: "group_leader",
        created_at: new Date().toISOString(),
        document_type: data.document_type, // 🔥 Nuevo campo guardado
      }
  
      await firebaseClient.createRegistration(registrationData)
  
      // 3. Marcar código como usado
      await firebaseClient.updateAccessCode(verifiedAccessCode.id, {
        status: "used",
        assigned_to_group: true,
      })
  
      // 4. Actualizar cupos
      if (data.route_id_day1) {
        await firebaseClient.updateSpots(data.route_id_day1, verifiedAccessCode.people_count, 1)
      }
      if (data.route_id_day2) {
        await firebaseClient.updateSpots(data.route_id_day2, verifiedAccessCode.people_count, 2)
      }
  
      // Redirigir a la página del grupo
      router.push(`/grupo/${newGroup.id}`)
  
    } catch (error) {
      console.error("Error guardando líder:", error)
      toast.error("Hubo un problema al guardar los datos del líder")
    } finally {
      setLoading(false)
    }
  }

  // Manejar inscripción individual
  const handleInscription = async (data: z.infer<typeof inscriptionSchema>) => {
    setLoading(true)
    try {
      const registrationData = {
        document_id: data.document_id,
        full_name: data.full_name,
        phone: data.phone,
        rh: data.rh,
        route_id_day1: data.route_id_day1,
        route_id_day2: data.route_id_day2,
        access_code: data.confirmation_code,
        group_id: "independiente", // ✅ Nuevo campo
        payment_status: "paid",
        registration_type: "individual",
        created_at: new Date().toISOString(),
        document_type: data.document_type,
      }
  
      await firebaseClient.createRegistration(registrationData)
  
      // Marcar código como usado
      await firebaseClient.updateAccessCode(verifiedAccessCode.id, { status: "used" })
  
      // Actualizar cupos
      if (data.route_id_day1) {
        await firebaseClient.updateSpots(data.route_id_day1, 1, Number.parseInt("1"))
      }
      if (data.route_id_day2) {
        await firebaseClient.updateSpots(data.route_id_day2, 1, Number.parseInt("2"))
      }
  
      setVerificationStep("success")
      toast.success("¡Inscripción completada exitosamente!")
    } catch (error) {
      console.error("Error completing inscription:", error)
      toast.error("Error al completar la inscripción")
    } finally {
      setLoading(false)
    }
  }

  const handleActualizar = async (formData: z.infer<typeof inscriptionSchema>) => {
    setLoading(true)
    try {
      // 1. Validar si el código ya fue usado y obtener datos existentes
      if (!verifiedAccessCode || verifiedAccessCode.status !== "used") {
        toast.error("Este código no ha sido usado o no está verificado")
        return
      }
  
      // 2. Buscar la inscripción existente por documento
      const existingRegistration = await firebaseClient.getRegistrationByDocument(formData.document_id)
  
      if (!existingRegistration) {
        toast.error("No se encontró una inscripción para este documento")
        return
      }
  
      // 3. Extraer datos anteriores (para comparar cambios de ruta)
      const oldRouteDay1 = existingRegistration.route_id_day1
      const oldRouteDay2 = existingRegistration.route_id_day2
  
      // 4. Preparar nuevos datos para actualizar
      const updatedData = {
        ...existingRegistration,
        full_name: formData.full_name || existingRegistration.full_name,
        phone: formData.phone || existingRegistration.phone,
        rh: formData.rh || existingRegistration.rh,
        route_id_day1: formData.route_id_day1 || null,
        route_id_day2: formData.route_id_day2 || null,
        updated_at: new Date().toISOString(),
      }
  
      // 5. Actualizar la inscripción en Firebase
      await firebaseClient.updateRegistration(formData.document_id, updatedData)
  
      // 6. Actualizar cupos si cambiaron las rutas
      const changes: { day: number; from?: string | null; to?: string | null }[] = []
  
      if (oldRouteDay1 !== updatedData.route_id_day1) {
        if (oldRouteDay1) {
          await firebaseClient.updateSpots(oldRouteDay1, -1, 1) // Liberar cupo
        }
        if (updatedData.route_id_day1) {
          await firebaseClient.updateSpots(updatedData.route_id_day1, 1, 1) // Restar cupo
        }
        changes.push({ day: 1, from: oldRouteDay1, to: updatedData.route_id_day1 })
      }
  
      if (oldRouteDay2 !== updatedData.route_id_day2) {
        if (oldRouteDay2) {
          await firebaseClient.updateSpots(oldRouteDay2, -1, 2) // Liberar cupo
        }
        if (updatedData.route_id_day2) {
          await firebaseClient.updateSpots(updatedData.route_id_day2, 1, 2) // Restar cupo
        }
        changes.push({ day: 2, from: oldRouteDay2, to: updatedData.route_id_day2 })
      }
  
      // 7. Mostrar mensaje según lo que haya cambiado
      if (changes.some(c => c.from && c.to)) {
        toast.success("Rutas actualizadas correctamente")
      } else if (changes.length > 0) {
        toast.success("Datos actualizados correctamente")
      } else {
        toast.success("Datos personales actualizados correctamente")
      }
  
      // 8. Recargar página o redirigir si es necesario
      window.location.reload()
  
    } catch (error) {
      console.error("Error al actualizar inscripción:", error)
      toast.error("Hubo un error al actualizar tus datos")
    } finally {
      setLoading(false)
    }
  }

  // Manejar inscripción de grupo
  /*const handleGroupInscription = async (data: z.infer<typeof inscriptionSchema>) => {
    setLoading(true)
    try {
      const leaderData = {
        document_id: data.document_id,
        full_name: data.leader_full_name,
        phone: data.phone,
        rh: data.rh,
        route_id_day1: data.route_id_day1,
        route_id_day2: data.route_id_day2,
        access_code: data.confirmation_code,
        group_name: data.group_name,
        is_group: true,
        people_count: verifiedAccessCode.people_count,
        payment_status: "paid",
        registration_type: "group_leader",
        created_at: new Date().toISOString(),
        document_type: data.document_type,
      }

      await firebaseClient.createRegistration(leaderData)

      // Registrar caminantes
      const walkerRegistrations = data.walkers?.map(walker => ({
        ...walker,
        route_id_day1: data.route_id_day1,
        route_id_day2: data.route_id_day2,
        registration_type: "group_member",
        group_leader_document: data.document_id,
        created_at: new Date().toISOString(),
      })) || []

      await Promise.all(
        walkerRegistrations.map(reg => firebaseClient.createRegistration(reg))
      )

      // Actualizar cupos
      if (data.route_id_day1) {
        await firebaseClient.updateSpots(data.route_id_day1, verifiedAccessCode.people_count, 1)
      }
      if (data.route_id_day2) {
        await firebaseClient.updateSpots(data.route_id_day2, verifiedAccessCode.people_count, 2)
      }

      // Marcar código como usado
      await firebaseClient.updateAccessCode(verifiedAccessCode.id, { status: "used" })

      setVerificationStep("success")
      toast.success("¡Grupo registrado exitosamente!")
    } catch (error) {
      console.error("Error registrando grupo:", error)
      toast.error("Error al registrar el grupo")
    } finally {
      setLoading(false)
    }
  }*/
const fechaInicioInscripciones = new Date(2026, 0, 1); // Mes 0 es Enero, día 1

// Obtiene la fecha y hora actual
const fechaActual = new Date();

// Comprueba si la fecha actual es posterior o igual a la fecha de inicio
const inscripcionesAbiertas = fechaActual >= fechaInicioInscripciones;
  return (
  inscripcionesAbiertas ? (
    // ----------------------------------------------------------------
    // 1. BLOQUE VERDADERO: FORMULARIO (Inscripciones Abiertas)
    // ----------------------------------------------------------------
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 mb-8">
              <Button
                onClick={() => router.push("/")}
                variant="outline"
                className="w-full md:w-auto border-2 border-green-600 text-green-600 hover:bg-green-50 shadow-md font-semibold"
              >
                ← Volver al Inicio
              </Button>
            </div>
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Completar Inscripción</h1>
            <p className="text-gray-600">
              {verificationStep === "verify" && "Verifica tu código de confirmación para continuar"}
              {verificationStep === "individual" && "Completa tus datos personales"}
              {verificationStep === "group_leader" && "Completa los datos del líder y agrega los caminantes"}
              {verificationStep === "success" && "¡Tu inscripción ha sido completada!"}
            </p>
          </div>

           {/* Paso 1: Verificación  */}
          {verificationStep === "verify" && (
            <Card>
              <CardHeader>
                <CardTitle>Verificación de Código de Acceso</CardTitle>
                <CardDescription>
                  Ingresa tu número de documento y el código de acceso que recibiste por WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="document_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Documento</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej. 1234567890" {...field} />
                          </FormControl>
                          <FormDescription>El mismo documento usado para generar el código</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="confirmation_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código de Acceso</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej. IND-123456 o GRP-123456" {...field} />
                          </FormControl>
                          <FormDescription>El código que recibiste por WhatsApp después del pago</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button onClick={handleVerification} disabled={loading} className="w-full">
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Verificar Código
                    </Button>
                  </div>
                </Form>
              </CardContent>
            </Card>
          )}

          {/* Paso 2: Usuario Individual */}
          {verificationStep === "individual" && (
            <Card>
              <CardHeader>
                <CardTitle>Datos Personales</CardTitle>
                <CardDescription>Completa tus datos personales</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleInscription)} className="space-y-6">
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Código Verificado</AlertTitle>
                      <AlertDescription>Tu código ha sido validado exitosamente.</AlertDescription>
                    </Alert>
                    

                    <FormField
                      control={form.control}
                      name="full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre Completo</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej. Juan Pérez" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="document_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Documento</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un tipo de documento" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="cedula">Cédula de Ciudadanía</SelectItem>
                              <SelectItem value="tarjeta_identidad">Tarjeta de Identidad</SelectItem>
                              <SelectItem value="pasaporte">Pasaporte</SelectItem>
                              <SelectItem value="otro">Otro</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="document_id"
                      render={() => (
                        <FormItem>
                          <FormLabel>N° de Documento</FormLabel>
                          <FormControl>
                            <Input value={form.getValues("document_id")} disabled />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rh"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>RH</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej. O+" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej. 3001234567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="route_id_day1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ruta Día 1</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona una ruta" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {routes
                                .filter((route) =>
                                  route.available_spots_by_day.some((d) => d.day === 1 && d.spots > 0)
                                )
                                .map((route) => (
                                  <SelectItem key={route.id} value={route.id}>
                                    {route.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="route_id_day2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ruta Día 2</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona una ruta" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                               {routes
                                  .filter((route) =>
                                    route.available_spots_by_day.some((d) => d.day === 2 && d.spots > 0)
                                  )
                                  .map((route) => (
                                    <SelectItem key={route.id} value={route.id}>
                                      {route.name}
                                    </SelectItem>
                                  ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="button" 
                      disabled={loading} 
                      onClick={() => {
                        const formData = form.getValues()
                        if (verifiedAccessCode.status === "used") {
                          handleActualizar(formData)
                        } else {
                          handleInscription(formData)
                        }
                      }} 
                      className="w-full"
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {verifiedAccessCode.status === "used" ? 'Actualizar Datos' : 'Completar Inscripción'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {/* Paso 3: Grupo */}
          {verificationStep === "group_leader" && (
            <Card>
            <CardHeader>
              <CardTitle>Datos del Líder del Grupo</CardTitle>
              <CardDescription>Completa tus datos personales y selecciona las rutas</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSaveLeader)} className="space-y-6">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Código Verificado</AlertTitle>
                    <AlertDescription>
                      Grupo de {verifiedAccessCode.people_count} personas. Eres el líder del grupo.
                    </AlertDescription>
                  </Alert>
                  <FormField
                    control={form.control}
                    name="group_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Grupo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. Grupo Aventureros" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="leader_full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre Completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. María López" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="document_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Documento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un tipo de documento" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cedula">Cédula de Ciudadanía</SelectItem>
                            <SelectItem value="tarjeta_identidad">Tarjeta de Identidad</SelectItem>
                            <SelectItem value="pasaporte">Pasaporte</SelectItem>
                            <SelectItem value="otro">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="document_id"
                    render={() => (
                      <FormItem>
                        <FormLabel>Cédula</FormLabel>
                        <FormControl>
                          <Input value={form.getValues("document_id")} disabled />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rh"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RH</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. AB+" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. 3001234567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="route_id_day1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ruta Día 1</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona una ruta" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {routes
                                .filter((route) =>
                                  route.available_spots_by_day.some((d) => d.day === 1 && d.spots > 0)
                                )
                                .map((route) => (
                                  <SelectItem key={route.id} value={route.id}>
                                    {route.name}
                                  </SelectItem>
                                ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="route_id_day2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ruta Día 2</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona una ruta" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {routes
                                  .filter((route) =>
                                    route.available_spots_by_day.some((d) => d.day === 2 && d.spots > 0)
                                  )
                                  .map((route) => (
                                    <SelectItem key={route.id} value={route.id}>
                                      {route.name}
                                    </SelectItem>
                                  ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="button" 
                    disabled={loading} 
                    onClick={() => {
                      const formData = form.getValues()
                      handleSaveLeader(formData)
                    }} 
                    className="w-full"
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar Líder y Continuar
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          )}

          {/* Éxito */}
          {verificationStep === "success" && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Inscripción Completada!</h2>
                  <p className="text-gray-600 mb-6">
                    Tu inscripción ha sido procesada exitosamente.
                    {verifiedAccessCode?.is_group && (
                      <span className="block mt-2">
                        <strong>Grupo de {verifiedAccessCode.people_count} personas registrado.</strong>
                      </span>
                    )}
                  </p>
                  <div className="space-y-2">
                    <Button onClick={() => router.push("/")} className="w-full">
                      Volver al Inicio
                    </Button>
                    <Button variant="outline" onClick={() => router.push("/rutas")} className="w-full">
                      Ver Otras Rutas
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  ) : (
    // ----------------------------------------------------------------
    // 2. BLOQUE FALSO: MENSAJE (Inscripciones Cerradas)
    // ----------------------------------------------------------------
    <div className="flex items-center justify-center min-h-screen bg-slate-900 p-4">
  <div className="
    bg-white 
    p-10 md:p-16 
    rounded-2xl 
    shadow-2xl 
    text-center 
    max-w-md 
    w-full 
    transform 
    hover:scale-[1.01] 
    transition-transform 
    duration-300
    border-t-4 border-green-500
  ">
    {/* Icono (requiere importar un componente de icono) */}
    {/* Asegúrate de importar CalendarIcon de tu librería preferida (ej. Lucide React) */}
    <CalendarIcon className="h-12 w-12 text-green-600 mx-auto mb-4 animate-pulse" /> 

    <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3 uppercase">
      ¡INSCRIPCIONES PRÓXIMAMENTE!
    </h1>


    <div className="
      inline-block 
      bg-green-100 
      text-green-800 
      font-bold 
      py-2 px-4 
      rounded-full 
      text-xl
    ">
      Apertura: 1 DE ENERO DE 2026
    </div>
  </div>
</div>
  )
);
}