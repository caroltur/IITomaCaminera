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

// ✅ NUEVO: Tipo para las configuraciones de fechas
type EventSettings = {
  registration_start_date: string;
  registration_end_date: string;
  updated_at?: string;
}

const walkerSchema = z.object({
  id: z.string().optional(),
  full_name: z.string().min(3, "El nombre completo del caminante es requerido"),
  document_id: z.string().min(5, "El número de documento del caminante es requerido"),
  document_type: z.string().optional(),
  phone: z.string().min(7, "El teléfono del caminante es requerido").optional(),
  rh: z.string().min(1, "El RH del caminante es requerido").optional(),
})

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
  const [verificationStep, setVerificationStep] = useState<"verify" | "individual" | "group_leader" | "success">("verify")
  const [verifiedAccessCode, setVerifiedAccessCode] = useState<any>(null)
  const [inscripcionesAbiertas, setInscripcionesAbiertas] = useState<boolean | null>(null)
  const [eventDates, setEventDates] = useState<EventSettings | null>(null)
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
    },
  })

  // ✅ NUEVO: Cargar fechas de configuración y verificar si están abiertas
  useEffect(() => {
    const checkRegistrationDates = async () => {
      try {
        // Cargar configuraciones del evento
        const settings = await firebaseClient.getSettings()
        setEventDates(settings)
        
        const fechaActual = new Date()
        
        if (!settings.registration_start_date || !settings.registration_end_date) {
          // Si no hay fechas configuradas, permitir inscripciones (compatibilidad hacia atrás)
          setInscripcionesAbiertas(true)
          return
        }
        
        const fechaInicio = new Date(settings.registration_start_date)
        const fechaFin = new Date(settings.registration_end_date)
        
        // Ajustar fechas para comparación (sin horas/minutos)
        fechaInicio.setHours(0, 0, 0, 0)
        fechaFin.setHours(23, 59, 59, 999)
        fechaActual.setHours(0, 0, 0, 0)
        
        // Verificar si la fecha actual está dentro del rango
        const abiertas = fechaActual >= fechaInicio && fechaActual <= fechaFin
        setInscripcionesAbiertas(abiertas)
        
        console.log("Fechas de inscripción:", {
          inicio: fechaInicio.toLocaleDateString(),
          fin: fechaFin.toLocaleDateString(),
          actual: fechaActual.toLocaleDateString(),
          abiertas: abiertas
        })
        
      } catch (error) {
        console.error("Error cargando fechas de inscripción:", error)
        // Por defecto, permitir inscripciones si hay error
        setInscripcionesAbiertas(true)
      }
    }
    
    checkRegistrationDates()
    fetchRoutes()
  }, [])

  const fetchRoutes = async () => {
    try {
      const routesData = await firebaseClient.getRoutes()
      const routesWithAvailability = await Promise.all(
        routesData.map(async (route) => {
          const availableSpotsTemplate = route.available_spots_by_day || []
          const registeredByDay = await firebaseClient.getAvailableSpotsByRoute(route.id)

          const availableSpotsByDay = availableSpotsTemplate
            .map((daySpot: { day: number; spots: number }) => ({
              day: daySpot.day,
              spots: Math.max(0, daySpot.spots - (registeredByDay[daySpot.day] || 0)),
            }))
            .filter((daySpot) => daySpot.spots > 0)

          if (availableSpotsByDay.length === 0) return null

          return {
            ...route,
            available_spots_by_day: availableSpotsByDay,
          }
        }),
      )

      const validRoutes = routesWithAvailability.filter((route) => route !== null)
      setRoutes(validRoutes)
    } catch (error) {
      console.error("Error fetching routes:", error)
      toast.error("Error al cargar las rutas")
    }
  }

  // ✅ NUEVO: Función para formatear fechas
  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return "No configurado"
    
    try {
      // Parsear la fecha manualmente para evitar problemas de zona horaria
      const [year, month, day] = dateString.split('-').map(Number)
      
      // Crear fecha como mediodía local (evita problemas de cambio de día)
      const date = new Date(year, month - 1, day, 12, 0, 0)
      
      // Formatear en español de Colombia
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }
      
      return date.toLocaleDateString('es-CO', options)
    } catch (error) {
      console.error("Error formateando fecha:", error)
      // Fallback: mostrar fecha original
      return dateString
    }
  }

  // Verificar código de acceso
  const handleVerification = async () => {
    // ✅ Verificar si las inscripciones están abiertas
    if (inscripcionesAbiertas === false) {
      toast.error("El período de inscripciones está cerrado")
      return
    }

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
        
        const existingRegistration = await firebaseClient.getRegistrationByDocument(documentId)
  
        if (existingRegistration) {
          console.log("Registro existente encontrado:", existingRegistration)
          
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
      if (!data.leader_full_name || !data.phone || !data.rh || !data.group_name || !data.document_type) {
        toast.error("Todos los campos son requeridos")
        return
      }
  
      const newGroup = await firebaseClient.createGroup({
        group_name: data.group_name,
        leader_document_id: data.document_id,
        member_count: verifiedAccessCode.people_count,
      })
  
      const registrationData = {
        document_id: data.document_id,
        full_name: data.leader_full_name,
        phone: data.phone,
        rh: data.rh,
        route_id_day1: data.route_id_day1,
        route_id_day2: data.route_id_day2,
        access_code: data.confirmation_code,
        group_id: newGroup.id,
        payment_status: "paid",
        registration_type: "group_leader",
        created_at: new Date().toISOString(),
        document_type: data.document_type,
      }
  
      await firebaseClient.createRegistration(registrationData)
  
      await firebaseClient.updateAccessCode(verifiedAccessCode.id, {
        status: "used",
        assigned_to_group: true,
      })
  
      if (data.route_id_day1) {
        await firebaseClient.updateSpots(data.route_id_day1, verifiedAccessCode.people_count, 1)
      }
      if (data.route_id_day2) {
        await firebaseClient.updateSpots(data.route_id_day2, verifiedAccessCode.people_count, 2)
      }
  
      router.push(`/grupo/${newGroup.id}`)
  
    } catch (error) {
      console.error("Error guardando líder:", error)
      toast.error("Hubo un problema al guardar los datos del líder")
    } finally {
      setLoading(false)
    }
  }

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
        group_id: "independiente",
        payment_status: "paid",
        registration_type: "individual",
        created_at: new Date().toISOString(),
        document_type: data.document_type,
      }
  
      await firebaseClient.createRegistration(registrationData)
  
      await firebaseClient.updateAccessCode(verifiedAccessCode.id, { status: "used" })
  
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
      if (!verifiedAccessCode || verifiedAccessCode.status !== "used") {
        toast.error("Este código no ha sido usado o no está verificado")
        return
      }
  
      const existingRegistration = await firebaseClient.getRegistrationByDocument(formData.document_id)
  
      if (!existingRegistration) {
        toast.error("No se encontró una inscripción para este documento")
        return
      }
  
      const oldRouteDay1 = existingRegistration.route_id_day1
      const oldRouteDay2 = existingRegistration.route_id_day2
  
      const updatedData = {
        ...existingRegistration,
        full_name: formData.full_name || existingRegistration.full_name,
        phone: formData.phone || existingRegistration.phone,
        rh: formData.rh || existingRegistration.rh,
        route_id_day1: formData.route_id_day1 || null,
        route_id_day2: formData.route_id_day2 || null,
        updated_at: new Date().toISOString(),
      }
  
      await firebaseClient.updateRegistration(formData.document_id, updatedData)
  
      const changes: { day: number; from?: string | null; to?: string | null }[] = []
  
      if (oldRouteDay1 !== updatedData.route_id_day1) {
        if (oldRouteDay1) {
          await firebaseClient.updateSpots(oldRouteDay1, -1, 1)
        }
        if (updatedData.route_id_day1) {
          await firebaseClient.updateSpots(updatedData.route_id_day1, 1, 1)
        }
        changes.push({ day: 1, from: oldRouteDay1, to: updatedData.route_id_day1 })
      }
  
      if (oldRouteDay2 !== updatedData.route_id_day2) {
        if (oldRouteDay2) {
          await firebaseClient.updateSpots(oldRouteDay2, -1, 2)
        }
        if (updatedData.route_id_day2) {
          await firebaseClient.updateSpots(updatedData.route_id_day2, 1, 2)
        }
        changes.push({ day: 2, from: oldRouteDay2, to: updatedData.route_id_day2 })
      }
  
      if (changes.some(c => c.from && c.to)) {
        toast.success("Rutas actualizadas correctamente")
      } else if (changes.length > 0) {
        toast.success("Datos actualizados correctamente")
      } else {
        toast.success("Datos personales actualizados correctamente")
      }
  
      window.location.reload()
  
    } catch (error) {
      console.error("Error al actualizar inscripción:", error)
      toast.error("Hubo un error al actualizar tus datos")
    } finally {
      setLoading(false)
    }
  }

  return (
    inscripcionesAbiertas === null ? (
      // Cargando estado
      <div className="flex items-center justify-center min-h-screen bg-slate-900 p-4">
        <div className="bg-white p-10 md:p-16 rounded-2xl shadow-2xl text-center max-w-md w-full">
          <div className="animate-pulse">
            <div className="h-12 w-12 bg-gray-300 rounded-full mx-auto mb-4"></div>
            <div className="h-6 bg-gray-300 rounded w-3/4 mx-auto mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    ) : inscripcionesAbiertas ? (
      // FORMULARIO (Inscripciones Abiertas)
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
            {/* ✅ NUEVO: Mostrar período de inscripciones */}
            {eventDates && (
              <Card className="mb-6 bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="font-semibold text-blue-800 mb-2">Período de Inscripciones</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Inicio:</p>
                        <p className="font-medium">{formatDateForDisplay(eventDates.registration_start_date)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Cierre:</p>
                        <p className="font-medium">{formatDateForDisplay(eventDates.registration_end_date)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Completar Inscripción</h1>
              <p className="text-gray-600">
                {verificationStep === "verify" && "Verifica tu código de confirmación para continuar"}
                {verificationStep === "individual" && "Completa tus datos personales"}
                {verificationStep === "group_leader" && "Completa los datos del líder y agrega los caminantes"}
                {verificationStep === "success" && "¡Tu inscripción ha sido completada!"}
              </p>
            </div>

            {/* Resto del formulario (sin cambios en la lógica) */}
            {/* ... mantener todo el código existente del formulario ... */}
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

            {/* ... resto del código del formulario (individual, group_leader, success) ... */}
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
      // MENSAJE (Inscripciones Cerradas)
      <div className="flex items-center justify-center min-h-screen bg-slate-900 p-4">
        <div className="bg-white p-10 md:p-16 rounded-2xl shadow-2xl text-center max-w-md w-full transform hover:scale-[1.01] transition-transform duration-300 border-t-4 border-green-500">
          <CalendarIcon className="h-12 w-12 text-green-600 mx-auto mb-4 animate-pulse" />
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3 uppercase">
            {eventDates ? "¡INSCRIPCIONES CERRADAS!" : "¡INSCRIPCIONES NO DISPONIBLES!"}
          </h1>
          
          {eventDates ? (
            <>
              
              <div className="space-y-3 text-left mb-6">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Período de inscripciones.</p>
                  <p className="text-sm text-gray-500">Inicio:</p>
                  <p className="font-medium">{formatDateForDisplay(eventDates.registration_start_date)}</p>
                  <p className="text-gray-600 text-sm">Cierre:</p>
                  <p className="font-medium">{formatDateForDisplay(eventDates.registration_end_date)}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-600 mb-6">
              Las fechas de inscripción no han sido configuradas todavía.
            </p>
          )}
          
          <Button 
            onClick={() => router.push("/")} 
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg"
          >
            Volver al Inicio
          </Button>
        </div>
      </div>
    )
  )
}