"use client"

import { useState, useEffect } from "react" // Añadir useEffect
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Package, CheckCircle, Search, RefreshCw, UserCheck, Clock, Users } from "lucide-react" // Iconos añadidos
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { firebaseClient } from "@/lib/firebase/client"

// --- Definir tipos basados en la estructura de Firebase ---
type Registration = {
  id: string
  full_name: string
  document_id: string
  route_id_day1?: string
  route_id_day2?: string
  payment_status: "pending" | "paid"
  souvenir_status: "pending" | "delivered"
  registration_code?: string
  // Campos que pueden venir del code
  route_name_day1?: string
  route_name_day2?: string
}

type AccessCode = {
  id: string
  code: string
  people_count: number
  people: Array<{
    full_name: string
    document_id: string
    // ...otros campos de persona
  }>
  // ...otros campos del código
}

// --- Esquema del formulario (sin cambios) ---
const souvenirFormSchema = z.object({
  document_id: z.string().min(5, "El número de documento es requerido"),
})

export default function SouvenirControl() {
  const [submitting, setSubmitting] = useState(false)
  const [searchResult, setSearchResult] = useState<Registration | null>(null)
  const [recentDeliveries, setRecentDeliveries] = useState<Registration[]>([])
  const [stats, setStats] = useState({
    totalInscritos: 0,
    entregados: 0,
    pendientes: 0
  })
  const [loadingStats, setLoadingStats] = useState(true)

  const form = useForm<z.infer<typeof souvenirFormSchema>>({
    resolver: zodResolver(souvenirFormSchema),
    defaultValues: {
      document_id: "",
    },
  })

  // --- 1. Función para cargar estadísticas desde Firebase ---
  const loadStatistics = async () => {
    setLoadingStats(true)
    try {
      // Obtener todas las inscripciones
      const allRegistrations = await firebaseClient.getRegistrations()
      
      const total = allRegistrations.length
      const entregados = allRegistrations.filter(r => r.souvenir_status === "delivered").length
      const pendientes = total - entregados

      setStats({
        totalInscritos: total,
        entregados,
        pendientes
      })
    } catch (error) {
      console.error("Error cargando estadísticas:", error)
      toast.error("Error", {
        description: "No se pudieron cargar las estadísticas.",
      })
    } finally {
      setLoadingStats(false)
    }
  }

  // --- 2. Función para cargar entregas recientes ---
  const loadRecentDeliveries = async () => {
    try {
      const allRegistrations = await firebaseClient.getRegistrations()
      const entregados = allRegistrations
        .filter(r => r.souvenir_status === "delivered")
        .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
        .slice(0, 5) // Últimos 5

      setRecentDeliveries(entregados)
    } catch (error) {
      console.error("Error cargando entregas recientes:", error)
    }
  }

  // --- Cargar datos iniciales ---
  useEffect(() => {
    loadStatistics()
    loadRecentDeliveries()
  }, [])

  // --- 3. Función principal de búsqueda y registro ---
  const onSubmit = async (data: z.infer<typeof souvenirFormSchema>) => {
    setSubmitting(true)
    setSearchResult(null)

    try {
      // Buscar en TODAS las inscripciones
      const allRegistrations = await firebaseClient.getRegistrations()
      const foundRegistration = allRegistrations.find(
        reg => reg.document_id === data.document_id
      )

      if (!foundRegistration) {
        toast.error("Persona no encontrada", {
          description: "No se encontró ninguna inscripción con ese número de documento.",
        })
        setSubmitting(false)
        return
      }

      // Mostrar resultado encontrado
      setSearchResult(foundRegistration)

      // Si ya está entregado, no hacer nada más
      if (foundRegistration.souvenir_status === "delivered") {
        toast.info("Souvenir ya entregado", {
          description: `El souvenir para ${foundRegistration.full_name} ya fue marcado como entregado anteriormente.`,
        })
        setSubmitting(false)
        return
      }

      // Verificar estado de pago
      if (foundRegistration.payment_status !== "paid") {
        toast.warning("Pago pendiente", {
          description: "Esta persona aún no ha confirmado su pago. No se puede entregar el souvenir.",
        })
        setSubmitting(false)
        return
      }

      // --- CONFIRMAR ENTREGA ---
      const confirm = window.confirm(
        `¿Confirmar entrega de souvenir a ${foundRegistration.full_name} (Documento: ${foundRegistration.document_id})?`
      )

      if (!confirm) {
        setSubmitting(false)
        return
      }

      // Actualizar en Firebase
      await firebaseClient.updateRegistration(foundRegistration.document_id, { 
        souvenir_status: "delivered",
        updated_at: new Date().toISOString()
      })

      toast.success("Souvenir entregado", {
        description: `Souvenir marcado como entregado para ${foundRegistration.full_name}`,
      })

      // Actualizar UI inmediatamente
      const updatedRegistration = { 
        ...foundRegistration, 
        souvenir_status: "delivered" as const 
      }
      setSearchResult(updatedRegistration)
      
      // Recargar estadísticas y entregas recientes
      await Promise.all([
        loadStatistics(),
        loadRecentDeliveries()
      ])

      form.reset()

    } catch (error) {
      console.error("Error en el proceso:", error)
      toast.error("Error", {
        description: "Hubo un problema al procesar la solicitud.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  // --- 4. Función para refrescar datos ---
  const handleRefresh = async () => {
    await Promise.all([
      loadStatistics(),
      loadRecentDeliveries()
    ])
    toast.info("Datos actualizados")
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold ml-8">Control de Souvenirs</h1>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refrescar datos
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- TARJETA DE BÚSQUEDA Y REGISTRO --- */}
        <Card>
          <CardHeader>
            <CardTitle>Marcar Souvenir como Entregado</CardTitle>
            <CardDescription>Busca por número de documento para registrar la entrega.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="document_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de documento</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ej. 1234567890" 
                          {...field} 
                          disabled={submitting}
                        />
                      </FormControl>
                      <FormDescription>Documento de la persona que recibe el souvenir</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? (
                    <>
                      <Search className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Package className="mr-2 h-4 w-4" />
                      Buscar y Registrar Entrega
                    </>
                  )}
                </Button>
              </form>
            </Form>

            {/* --- RESULTADO DE BÚSQUEDA --- */}
            {searchResult && (
              <div className="mt-6 p-4 border rounded-lg space-y-3">
                <h3 className="font-medium mb-2">Resultado de búsqueda</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Nombre:</span>
                    <span className="font-medium">{searchResult.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Documento:</span>
                    <span>{searchResult.document_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Código de inscripción:</span>
                    <span>{searchResult.registration_code || "No disponible"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Estado de pago:</span>
                    <Badge className={searchResult.payment_status === "paid" ? "bg-green-500" : "bg-yellow-500"}>
                      {searchResult.payment_status === "paid" ? "Pagado" : "Pendiente"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Estado del souvenir:</span>
                    <Badge className={searchResult.souvenir_status === "delivered" ? "bg-green-500" : "bg-yellow-500"}>
                      {searchResult.souvenir_status === "delivered" ? "Entregado" : "Pendiente"}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* --- TARJETA DE ENTREGAS RECIENTES --- */}
        <Card>
          <CardHeader>
            <CardTitle>Entregas Recientes</CardTitle>
            <CardDescription>Últimos 5 souvenirs marcados como entregados.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentDeliveries.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay entregas recientes.</p>
            ) : (
              <div className="space-y-3">
                {recentDeliveries.map((person, index) => (
                  <div
                    key={person.id || index}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{person.full_name}</p>
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>{person.document_id}</span>
                        {person.registration_code && (
                          <span className="font-mono">Código: {person.registration_code}</span>
                        )}
                      </div>
                    </div>
                    <CheckCircle className="h-5 w-5 text-green-600 ml-2 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* --- TARJETA DE ESTADÍSTICAS EN TIEMPO REAL --- */}
      <Card>
        <CardHeader>
          <CardTitle>Estadísticas de Souvenirs</CardTitle>
          <CardDescription>Datos actualizados en tiempo real desde la base de datos</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStats ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="mt-2 text-gray-500">Cargando estadísticas...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-center items-center mb-2">
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-blue-600">{stats.totalInscritos}</p>
                <p className="text-sm text-gray-600">Total de inscritos</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="flex justify-center items-center mb-2">
                  <UserCheck className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-600">{stats.entregados}</p>
                <p className="text-sm text-gray-600">Souvenirs entregados</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="flex justify-center items-center mb-2">
                  <Clock className="h-8 w-8 text-yellow-600" />
                </div>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendientes}</p>
                <p className="text-sm text-gray-600">Pendientes de entrega</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- ALERTA CON INSTRUCCIONES --- */}
      <Alert>
        <Package className="h-4 w-4" />
        <AlertTitle>Instrucciones para el control de souvenirs</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Busca a la persona por su <strong>número de documento</strong> exacto.</li>
            <li>Solo se pueden entregar souvenirs a personas con estado de pago <strong>"Pagado"</strong>.</li>
            <li>Verifica los datos antes de confirmar la entrega.</li>
            <li>Los datos se actualizan automáticamente después de cada operación.</li>
            <li>Usa el botón "Refrescar datos" para actualizar manualmente.</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* --- TABLA DE EJEMPLOS (opcional, puedes eliminar) --- */}
      <Card>
        <CardHeader>
          <CardTitle>Información de referencia</CardTitle>
          <CardDescription>Ejemplos de documentos para prueba (si existen en tu base de datos)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Estado de pago</TableHead>
                <TableHead>Puede recibir souvenir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono">Cualquier documento existente</TableCell>
                <TableCell>
                  <Badge className="bg-green-500">Pagado</Badge>
                </TableCell>
                <TableCell>SÍ (si no se ha entregado antes)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">Documento con pago pendiente</TableCell>
                <TableCell>
                  <Badge className="bg-yellow-500">Pendiente</Badge>
                </TableCell>
                <TableCell>NO (hasta confirmar pago)</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">Documento no registrado</TableCell>
                <TableCell>-</TableCell>
                <TableCell>NO (persona no encontrada)</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Toaster />
    </div>
  )
}