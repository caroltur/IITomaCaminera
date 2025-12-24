"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Filter, Eye, Download } from "lucide-react"
import { firebaseClient } from "@/lib/firebase/client"
import * as XLSX from "xlsx";

// 1. Define una interfaz común para las rutas
interface Route {
  id: string;
  name: string;
}

interface Group {
  id: string;
  group_name: string;
}

// 2. Modifica el tipo 'Person'
type Person = {
  id: string; // ✅ ID debe ser string
  full_name: string;
  document_id: string;
  phone: string;
  rh?: string | null; // ✅ Añadido, ya que se usa en el diálogo
  route_name: string; // Nombre de la ruta, no el ID
  route_id_day1?: string | null; // ✅ Añadido, ya que se usa con getRouteName
  route_id_day2?: string | null; // ✅ Añadido, ya que se usa con getRouteName
  group_id?: string | null; // Añadido para manejar grupos
  registration_type: "individual" | "group_leader" | "group_member" | "staff";
  payment_status: "pending" | "paid";
  souvenir_status: "pending" | "delivered";
  registration_code?: string;
  // Si en el diálogo se usan 'leader_full_name' o 'group_name', añádelos aquí también.
}

export default function PersonManagement() {
  const [people, setPeople] = useState<Person[]>([])
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [routeFilter, setRouteFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  // 3. Usa la interfaz Route definida para el estado 'routes'
  const [routes, setRoutes] = useState<Route[]>([])
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [groups, setGroups] = useState<Group[]>([]); 

  useEffect(() => {
    fetchPeople()
    fetchRoutes()
    fetchGroups();
  }, [])

  useEffect(() => {
    applyFilters()
  }, [searchTerm, routeFilter, statusFilter, people, groups])

  const fetchPeople = async () => {
    setLoading(true)
    try {
      const data = await firebaseClient.getRegistrations()
      // ✅ Asegúrate de que los datos de Firebase se mapeen correctamente a Person.
      // Si firebaseClient.getRegistrations no devuelve 'id' como string, o incluye
      // 'route_id_day1', 'route_id_day2', 'rh' como 'any' o 'undefined',
      // deberías mapearlos aquí o tipar mejor 'getRegistrations' en firebaseClient.ts.
      // Ejemplo si necesitas mapear:
      // const mappedData: Person[] = data.map(doc => ({
      //   id: doc.id, // Suponiendo que doc.id es string
      //   ...doc.data() as Omit<Person, 'id'>, // Omit 'id' ya que lo añades manualmente
      //   route_id_day1: doc.data().route_id_day1 || null, // Manejar posibles undefined/null
      //   route_id_day2: doc.data().route_id_day2 || null,
      //   rh: doc.data().rh || null,
      // }));
      // setPeople(mappedData);
      // setFilteredPeople(mappedData);
      setPeople(data); // Si firebaseClient.getRegistrations ya devuelve Person[]
      setFilteredPeople(data);
    } catch (error) {
      console.error("Error fetching people:", error)
    } finally {
      setLoading(false)
    }
  }

  // En fetchRoutes:
  const fetchRoutes = async () => {
    try {
      const data = await firebaseClient.getRoutes()
      // ✅ Asegúrate de que los IDs de las rutas sean strings al mapear
      setRoutes(data.map((route) => ({ id: String(route.id), name: route.name })))
    } catch (error) {
      console.error("Error fetching routes:", error)
    }
  }
  const fetchGroups = async () => {
    try {
      const data = await firebaseClient.getGroups();
      setGroups(data);
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  const applyFilters = () => {
    let result = [...people]

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (person) =>
          person.full_name.toLowerCase().includes(term) ||
          person.document_id.includes(term),
      )
    }

    // Apply route filter
    if (routeFilter !== "all") {
      // ✅ Aquí puedes usar route_id_day1 o route_id_day2, o una lógica más compleja
      // Depende de cómo quieras filtrar por ruta. Si 'route_name' en Person es el nombre
      // de la ruta principal, entonces la comparación es directa.
      result = result.filter((person) => person.route_name === routeFilter)
    }

    // Apply status filter
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

  

  

  

  // ✅ Este useEffect está duplicado y debería ser eliminado o fusionado con el primero.
  // La llamada a 'fetchRoutes' ya se hace en el primer useEffect.
  /*
  useEffect(() => {
      const loadRoutes = async () => {
        try {
          const routesList = await firebaseClient.getRoutes()
          setRoutes(routesList)
        } catch (error) {
          console.error("Error loading routes:", error)
        }
      }
      loadRoutes()
    }, [])
  */

    // La función getRouteName está bien ahora que los tipos coinciden
    const getRouteName = (routeId: string | undefined | null): string => { // Añadido null al tipo de routeId por si viene de Firebase
      if (!routeId) return "-"
      const route = routes.find((r) => r.id === routeId) // ✅ r.id (string) === routeId (string)
      return route?.name || "Ruta desconocida"
    }
    const getGroupName = (groupId: string | undefined | null): string => {
      console.log("getGroupName called with groupId:", groupId); // Añadido para depuración
      console.log("Available groups:", groups); // Añadido para depuración
    if (!groupId) return "-";
    const group = groups.find((g) => g.id === groupId);
    console.log("Found group:", group?.group_name||" no encontrado"); // Añadido para depuración
    return group?.group_name || "Independiente";
  };
    const exportToExcel = () => {
    // 1. Prepara los datos a exportar
    const dataForExport = filteredPeople.map(person => ({
      "Nombre Completo": person.full_name,
      "Cédula": person.document_id,
      "Teléfono": person.phone,
      "RH": person.rh || "-",
      "Ruta Día 1": getRouteName(person.route_id_day1),
      "Ruta Día 2": getRouteName(person.route_id_day2),
      "Grupo": getGroupName(person.group_id)|| "-",
    }));

     const dataRutas = filteredPeople.map(person => ({
      "Nombre": person.full_name,
      "Documento": person.document_id,
      "Ruta Día 1": getRouteName(person.route_id_day1),
      "Ruta Día 2": getRouteName(person.route_id_day2),
    }));

    // 3. Preparar los datos para la hoja "Seguros"
    const dataSeguros = filteredPeople.map(person => ({
      "Nombre": person.full_name,
      "Cédula": person.document_id,
    }));

    // 2. Crea la hoja de cálculo a partir del JSON
    const workbook = XLSX.utils.book_new();

    const worksheetParticipantes = XLSX.utils.json_to_sheet(dataForExport);
    XLSX.utils.book_append_sheet(workbook, worksheetParticipantes, "Participantes");

    const worksheetRutas = XLSX.utils.json_to_sheet(dataRutas);
    XLSX.utils.book_append_sheet(workbook, worksheetRutas, "Rutas");

    // 7. Crear y adjuntar la hoja "Seguros"
    const worksheetSeguros = XLSX.utils.json_to_sheet(dataSeguros);
    XLSX.utils.book_append_sheet(workbook, worksheetSeguros, "Seguros");
    

    // 4. Escribe el archivo Excel y dispara la descarga
    XLSX.writeFile(workbook, "participantes.xlsx");
    };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold ml-8">Gestión de Personas</h1>
        <Button onClick={exportToExcel}>
          <Download className="mr-2 h-4 w-4" /> Exportar a Excel
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar por nombre, cédula, email o código..."
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
                      <SelectItem key={route.id} value={route.name}>
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
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Ruta Día 1</TableHead>
                  <TableHead>Ruta Día 2</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Cargando personas...
                    </TableCell>
                  </TableRow>
                ) : filteredPeople.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No se encontraron personas que coincidan con los filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPeople.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell className="font-medium">{person.full_name}</TableCell>
                      <TableCell>{person.document_id}</TableCell>
                      <TableCell>{person.phone}</TableCell>
                      <TableCell>{getRouteName(person.route_id_day1)}</TableCell>
                      <TableCell>{getRouteName(person.route_id_day2)}</TableCell>
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-sm text-gray-500">Nombre completo</p>
                  <p className="font-medium">{selectedPerson.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cédula</p>
                  <p className="font-medium">{selectedPerson.document_id}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-sm text-gray-500">RH</p>
                  <p className="font-medium">{selectedPerson.rh || "-"}</p> {/* Manejo de null/undefined */}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Teléfono</p>
                  <p className="font-medium">{selectedPerson.phone}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-sm text-gray-500">Ruta Día 1</p>
                  <p className="font-medium">{getRouteName(selectedPerson.route_id_day1)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ruta Día 2</p>
                  <p className="font-medium">{getRouteName(selectedPerson.route_id_day2)}</p>
                </div>
                
              </div>

              <div className="grid grid-cols-2 gap-2">
              <div>
                  <p className="text-sm text-gray-500">Tipo de registro</p>
                  <p className="font-medium">
                    {selectedPerson.registration_type === "individual" && "Individual"}
                    {selectedPerson.registration_type === "group_leader" && "Líder de grupo"}
                    {selectedPerson.registration_type === "group_member" && "Miembro de grupo"}
                    {selectedPerson.registration_type === "staff" && "Staff"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Estado de souvenir</p>
                  <p className="font-medium">
                    {selectedPerson.souvenir_status === "delivered" ? "Entregado" : "Pendiente"} {/* Asegura que el chequeo sea 'delivered' */}
                  </p>
                </div>
              </div>

              {selectedPerson.registration_code && (
                <div>
                  <p className="text-sm text-gray-500">Código de registro</p>
                  <p className="font-medium">{selectedPerson.registration_code}</p>
                </div>
              )}
              {/* ✅ 'email' en Person, pero no se muestra en el diálogo. Puedes añadirlo si es necesario. */}
              
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
