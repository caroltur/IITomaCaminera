"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Search, Filter, Eye, Download, UserPlus, Loader2 } from "lucide-react"
import { firebaseClient } from "@/lib/firebase/client"
import * as XLSX from "xlsx"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

// 1. Define interfaces comunes
interface Route {
  id: string
  name: string
}

interface Group {
  id: string
  group_name: string
}

type Person = {
  id: string
  full_name: string
  document_id: string
  phone: string
  rh?: string | null
  route_id_day1?: string | null
  route_id_day2?: string | null
  group_id?: string | null
  registration_type: "individual" | "group_leader" | "group_member" | "staff"
  payment_status: "pending" | "paid"
  souvenir_status: "pending" | "delivered"
  registration_code?: string
  access_code?: string
}

// Esquema para el formulario de creación manual
const createRegistrationSchema = z.object({
  document_type: z.string().min(2, "Tipo de documento requerido"),
  document_id: z.string().min(5, "Número de documento requerido"),
  full_name: z.string().min(3, "Nombre completo requerido"),
  phone: z.string().min(7, "Teléfono requerido"),
  rh: z.string().min(1, "RH requerido"),
  route_id_day1: z.string().optional(),
  route_id_day2: z.string().optional(),
  access_code: z.string().optional(),
  registration_type: z.enum(["individual", "group_leader", "group_member", "staff"]),
  payment_status: z.enum(["pending", "paid"]),
  group_id: z.string().optional(),
})

export default function PersonManagement() {
  const [people, setPeople] = useState<Person[]>([])
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [routeFilter, setRouteFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [routes, setRoutes] = useState<Route[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  
  // Estados para diálogos
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  // Formulario de creación manual
  const form = useForm<z.infer<typeof createRegistrationSchema>>({
    resolver: zodResolver(createRegistrationSchema),
    defaultValues: {
      document_type: "cedula",
      document_id: "",
      full_name: "",
      phone: "",
      rh: "",
      route_id_day1: "",
      route_id_day2: "",
      access_code: "",
      registration_type: "individual",
      payment_status: "paid",
      group_id: "independiente",
    },
  })

  useEffect(() => {
    fetchPeople()
    fetchRoutes()
    fetchGroups()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [searchTerm, routeFilter, statusFilter, people, groups])

  const fetchPeople = async () => {
    setLoading(true)
    try {
      const data = await firebaseClient.getRegistrations()
      setPeople(data)
      setFilteredPeople(data)
    } catch (error) {
      console.error("Error fetching people:", error)
      toast.error("Error al cargar los registros")
    } finally {
      setLoading(false)
    }
  }

  const fetchRoutes = async () => {
    try {
      const data = await firebaseClient.getRoutes()
      setRoutes(data.map((route: any) => ({ id: String(route.id), name: route.name })))
    } catch (error) {
      console.error("Error fetching routes:", error)
    }
  }

  const fetchGroups = async () => {
    try {
      const data = await firebaseClient.getGroups()
      setGroups(data)
    } catch (error) {
      console.error("Error fetching groups:", error)
    }
  }

  const applyFilters = () => {
    let result = [...people]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (person) =>
          person.full_name.toLowerCase().includes(term) ||
          person.document_id.includes(term) ||
          (person.access_code && person.access_code.toLowerCase().includes(term))
      )
    }

    // ✅ CORREGIDO: Filtrar por ID de ruta en lugar de nombre
    if (routeFilter !== "all") {
      result = result.filter(
        (person) => person.route_id_day1 === routeFilter || person.route_id_day2 === routeFilter
      )
    }

    if (statusFilter !== "all") {
      switch (statusFilter) {
        case "pending":
          result = result.filter((person) => person.payment_status === "pending")
          break
        case "paid":
          result = result.filter((person) => person.payment_status === "paid")
          break
        case "delivered":
          result = result.filter((person) => person.souvenir_status === "delivered")
          break
        case "staff":
          result = result.filter((person) => person.registration_type === "staff")
          break
      }
    }

    setFilteredPeople(result)
  }

  const getRouteName = (routeId: string | undefined | null): string => {
    if (!routeId) return "-"
    const route = routes.find((r) => r.id === routeId)
    return route?.name || "Ruta desconocida"
  }

  const getGroupName = (groupId: string | undefined | null): string => {
    if (!groupId || groupId === "independiente") return "Independiente"
    const group = groups.find((g) => g.id === groupId)
    return group?.group_name || "Grupo no encontrado"
  }

  const exportToExcel = () => {
    const dataForExport = filteredPeople.map((person) => ({
      "Nombre Completo": person.full_name,
      "Cédula": person.document_id,
      "Teléfono": person.phone,
      "RH": person.rh || "-",
      "Ruta Día 1": getRouteName(person.route_id_day1),
      "Ruta Día 2": getRouteName(person.route_id_day2),
      "Grupo": getGroupName(person.group_id),
      "Estado Pago": person.payment_status === "paid" ? "Pagado" : "Pendiente",
    }))

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(dataForExport)
    XLSX.utils.book_append_sheet(workbook, worksheet, "Participantes")
    XLSX.writeFile(workbook, "participantes.xlsx")
    toast.success("Archivo Excel descargado exitosamente")
  }

  const handleCreateRegistration = async (data: z.infer<typeof createRegistrationSchema>) => {
    try {
      const registrationData = {
        document_type: data.document_type,
        document_id: data.document_id,
        full_name: data.full_name,
        phone: data.phone,
        rh: data.rh,
        route_id_day1: data.route_id_day1 || null,
        route_id_day2: data.route_id_day2 || null,
        access_code: data.access_code || null,
        registration_type: data.registration_type,
        payment_status: data.payment_status,
        group_id: data.registration_type === "individual" ? "independiente" : (data.group_id || "pendiente"),
        souvenir_status: "pending" as const,
        created_at: new Date().toISOString(),
      }

      await firebaseClient.createRegistration(registrationData)
      toast.success("Registro creado exitosamente")
      setIsCreateOpen(false)
      form.reset()
      fetchPeople() // Recargar la tabla
    } catch (error) {
      console.error("Error creando registro:", error)
      toast.error("Error al crear el registro")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Personas</h1>
          <p className="text-gray-500 text-sm">Administra los registros e inscripciones de los participantes</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="default">
                <UserPlus className="mr-2 h-4 w-4" /> Crear Registro Manual
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Registro Manual</DialogTitle>
                <DialogDescription>
                  Registra a un participante directamente desde el panel de administración.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateRegistration)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="document_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Documento</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="cedula">Cédula de Ciudadanía</SelectItem>
                              <SelectItem value="tarjeta_identidad">Tarjeta de Identidad</SelectItem>
                              <SelectItem value="pasaporte">Pasaporte</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="document_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Documento</FormLabel>
                          <FormControl><Input placeholder="Ej. 1234567890" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre Completo</FormLabel>
                        <FormControl><Input placeholder="Nombre y apellidos" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono</FormLabel>
                          <FormControl><Input placeholder="Ej. 3001234567" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="rh"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Sangre (RH)</FormLabel>
                          <FormControl><Input placeholder="Ej. O+" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* ✅ CORREGIDO: Campos de ruta sin valor vacío */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="route_id_day1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ruta Día 1 (Opcional)</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(value === "none" ? "" : value)} 
                            value={field.value || "none"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar ruta" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Sin ruta asignada</SelectItem>
                              {routes.map((route) => (
                                <SelectItem key={route.id} value={route.id}>{route.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">
                            Selecciona una ruta o deja "Sin ruta asignada"
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="route_id_day2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ruta Día 2 (Opcional)</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(value === "none" ? "" : value)} 
                            value={field.value || "none"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar ruta" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Sin ruta asignada</SelectItem>
                              {routes.map((route) => (
                                <SelectItem key={route.id} value={route.id}>{route.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">
                            Selecciona una ruta o deja "Sin ruta asignada"
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="registration_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Registro</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="individual">Individual</SelectItem>
                              <SelectItem value="group_leader">Líder de Grupo</SelectItem>
                              <SelectItem value="group_member">Miembro de Grupo</SelectItem>
                              <SelectItem value="staff">Staff</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="payment_status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado de Pago</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="paid">Pagado</SelectItem>
                              <SelectItem value="pending">Pendiente</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="access_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código de Acceso (Opcional)</FormLabel>
                        <FormControl><Input placeholder="Ej. IND-123456" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">Guardar Registro</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" onClick={exportToExcel}>
            <Download className="mr-2 h-4 w-4" /> Exportar a Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar por nombre, cédula o código..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex items-center gap-2">
                <Filter className="text-gray-500 h-4 w-4" />
                <span className="text-sm text-gray-500 whitespace-nowrap">Ruta:</span>
                <Select value={routeFilter} onValueChange={setRouteFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todas las rutas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {routes.map((route) => (
                      <SelectItem key={route.id} value={route.id}>
                        {route.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="text-gray-500 h-4 w-4" />
                <span className="text-sm text-gray-500 whitespace-nowrap">Estado:</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendiente de pago</SelectItem>
                    <SelectItem value="paid">Pagado</SelectItem>
                    <SelectItem value="delivered">Souvenir entregado</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Ruta Día 1</TableHead>
                  <TableHead>Ruta Día 2</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-green-600" />
                      <p className="mt-2 text-gray-500">Cargando personas...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredPeople.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No se encontraron personas que coincidan con los filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPeople.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell className="font-medium">{person.full_name}</TableCell>
                      <TableCell>{person.document_id}</TableCell>
                      <TableCell>{getRouteName(person.route_id_day1)}</TableCell>
                      <TableCell>{getRouteName(person.route_id_day2)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          person.registration_type === 'individual' ? 'bg-blue-100 text-blue-800' :
                          person.registration_type === 'group_leader' ? 'bg-purple-100 text-purple-800' :
                          person.registration_type === 'staff' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {person.registration_type === 'individual' ? 'Individual' : 
                           person.registration_type === 'group_leader' ? 'Líder' : 
                           person.registration_type === 'staff' ? 'Staff' : 'Miembro'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          person.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {person.payment_status === 'paid' ? 'Pagado' : 'Pendiente'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedPerson(person)
                            setIsDetailsOpen(true)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Person Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalles de la Persona</DialogTitle>
            <DialogDescription>Información completa del participante.</DialogDescription>
          </DialogHeader>

          {selectedPerson && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Nombre completo</p>
                  <p className="font-medium">{selectedPerson.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cédula</p>
                  <p className="font-medium">{selectedPerson.document_id}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">RH</p>
                  <p className="font-medium">{selectedPerson.rh || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Teléfono</p>
                  <p className="font-medium">{selectedPerson.phone}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Ruta Día 1</p>
                  <p className="font-medium">{getRouteName(selectedPerson.route_id_day1)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ruta Día 2</p>
                  <p className="font-medium">{getRouteName(selectedPerson.route_id_day2)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Grupo</p>
                  <p className="font-medium">{getGroupName(selectedPerson.group_id)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tipo de registro</p>
                  <p className="font-medium capitalize">
                    {selectedPerson.registration_type.replace("_", " ")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Estado de pago</p>
                  <p className={`font-medium ${selectedPerson.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {selectedPerson.payment_status === "paid" ? "Pagado" : "Pendiente"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Souvenir</p>
                  <p className="font-medium">
                    {selectedPerson.souvenir_status === "delivered" ? "Entregado" : "Pendiente"}
                  </p>
                </div>
              </div>

              {selectedPerson.access_code && (
                <div>
                  <p className="text-sm text-gray-500">Código de acceso</p>
                  <p className="font-mono font-medium bg-gray-100 p-2 rounded text-center">
                    {selectedPerson.access_code}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}