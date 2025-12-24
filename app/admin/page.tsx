"use client"

import Link from "next/link"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Home, Route, Users, CreditCard, Package, Settings, Menu, X } from "lucide-react"
import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableRow, TableHead, TableHeader } from "@/components/ui/table"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { firebaseClient } from "@/lib/firebase/client"
import RouteManagement from "@/components/admin/route-management"
import PersonManagement from "@/components/admin/person-management"
import PaymentControl from "@/components/admin/payment-control"
import SouvenirControl from "@/components/admin/souvenir-control"
import PriceSettings from "@/components/admin/price-settings"

interface SpotByDay {
  day: number
  spots: number
}

interface RouteData {
  id: string
  name: string
  available_spots_by_day: SpotByDay[]
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("dashboard")
  const [totalInscritos, setTotalInscritos] = useState(0)
  const [cuposTotales, setCuposTotales] = useState(0)
  const [souvenirsEntregados, setSouvenirsEntregados] = useState(0)
  const [routesData, setRoutesData] = useState<{
    name: string
    day1Used: number
    day1Total: number
    day2Used: number
    day2Total: number
  }[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false) // ✅ NUEVO: Estado para menú móvil

  useEffect(() => {
    const loadData = async () => {
      try {
        const codesList = await firebaseClient.getAccessCodes()
        const totalSpotss = codesList          
          .reduce((acc, code) => acc + code.people_count, 0)
        setCuposTotales(totalSpotss)
        
        const registrationsList = await firebaseClient.getRegistrations()
        const totalRegistered = registrationsList.length
        setTotalInscritos(totalRegistered)
        
        const deliveredSouvenirs = registrationsList.filter(
          reg => reg.souvenir_status === "delivered"
        ).length
        setSouvenirsEntregados(deliveredSouvenirs)

        const routesList = await firebaseClient.getRoutes() as RouteData[]

        const routesWithStats = routesList.map(route => {
          const routeId = route.id
          const day1Used = registrationsList.filter(
            reg => reg.route_id_day1 === routeId
          ).length
          const day2Used = registrationsList.filter(
            reg => reg.route_id_day2 === routeId
          ).length
          const day1Total = route.available_spots_by_day.find((d: SpotByDay) => d.day === 1)?.spots || 0
          const day2Total = route.available_spots_by_day.find((d: SpotByDay) => d.day === 2)?.spots || 0

          return {
            id: route.id,
            name: route.name,
            day1Used,
            day1Total,
            day2Used,
            day2Total,
          }
        })

        setRoutesData(routesWithStats)

      } catch (error) {
        console.error("Error al cargar datos:", error)
        toast.error("No se pudieron cargar los datos")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleRefresh = async () => {
    setLoading(true)
    try {
      const codesList = await firebaseClient.getAccessCodes()
      const totalSpotss = codesList.reduce((acc, code) => acc + code.people_count, 0)
      setCuposTotales(totalSpotss)
      
      const registrationsList = await firebaseClient.getRegistrations()
      setTotalInscritos(registrationsList.length)
      
      const deliveredSouvenirs = registrationsList.filter(
        reg => reg.souvenir_status === "delivered"
      ).length
      setSouvenirsEntregados(deliveredSouvenirs)
      
      toast.success("Datos actualizados")
    } catch (error) {
      console.error("Error refreshing data:", error)
      toast.error("Error al actualizar los datos")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <span className="ml-2">Cargando datos...</span>
      </div>
    )
  }

  const cuposDisponibles = cuposTotales - totalInscritos

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar Desktop - Oculta en móvil */}
        <div className="hidden md:flex flex-col w-64 bg-white border-r h-screen sticky top-0">
          <div className="p-4 border-b">
            <h1 className="text-xl font-bold text-green-700">Panel de Administración</h1>
          </div>
          <nav className="flex-1 p-4">
            <ul className="space-y-1">
              <li>
                <Button
                  variant={activeTab === "dashboard" ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveTab("dashboard")}
                >
                  <Home className="mr-2 h-4 w-4" />
                  Inicio
                </Button>
              </li>
              <li>
                <Button
                  variant={activeTab === "routes" ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveTab("routes")}
                >
                  <Route className="mr-2 h-4 w-4 " />
                  Gestión de Rutas
                </Button>
              </li>
              <li>
                <Button
                  variant={activeTab === "people" ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveTab("people")}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Gestión de Personas
                </Button>
              </li>
              <li>
                <Button
                  variant={activeTab === "payments" ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveTab("payments")}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Códigos de Acceso
                </Button>
              </li>
              <li>
                <Button
                  variant={activeTab === "souvenirs" ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveTab("souvenirs")}
                >
                  <Package className="mr-2 h-4 w-4" />
                  Control de Souvenirs
                </Button>
              </li>
              <li>
                <Button
                  variant={activeTab === "prices" ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveTab("prices")}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Configuración de Precios
                </Button>
              </li>
            </ul>
          </nav>
          <div className="p-4 border-t">
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Ir al sitio público</Link>
            </Button>
          </div>
        </div>

        {/* Mobile Header - Solo muestra botón de menú y título */}
        <div className="md:hidden w-4  border-b sticky top-0 z-50">
          <div className="flex items-center justify-between p-0 ">
            <div className="flex items-center gap-4">
              {/* Botón para abrir menú vertical */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden scale-125"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
            
          </div>
        </div>

        {/* ✅ NUEVO: Menú Lateral para Móvil (Drawer) */}
        {mobileMenuOpen && (
          <>
            {/* Overlay para cerrar menú */}
            <div 
              className="md:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
            
            {/* Menú lateral móvil */}
            <div className="md:hidden fixed left-0 top-0 h-full w-64 bg-white z-50 shadow-lg overflow-y-auto">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-bold text-green-700">Menú</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              <nav className="p-4">
                <ul className="space-y-2">
                  <li>
                    <Button
                      variant={activeTab === "dashboard" ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => {
                        setActiveTab("dashboard")
                        setMobileMenuOpen(false)
                      }}
                    >
                      <Home className="mr-2 h-4 w-4" />
                      Inicio
                    </Button>
                  </li>
                  <li>
                    <Button
                      variant={activeTab === "routes" ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => {
                        setActiveTab("routes")
                        setMobileMenuOpen(false)
                      }}
                    >
                      <Route className="mr-2 h-4 w-4" />
                      Gestión de Rutas
                    </Button>
                  </li>
                  <li>
                    <Button
                      variant={activeTab === "people" ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => {
                        setActiveTab("people")
                        setMobileMenuOpen(false)
                      }}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Gestión de Personas
                    </Button>
                  </li>
                  <li>
                    <Button
                      variant={activeTab === "payments" ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => {
                        setActiveTab("payments")
                        setMobileMenuOpen(false)
                      }}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Códigos de Acceso
                    </Button>
                  </li>
                  <li>
                    <Button
                      variant={activeTab === "souvenirs" ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => {
                        setActiveTab("souvenirs")
                        setMobileMenuOpen(false)
                      }}
                    >
                      <Package className="mr-2 h-4 w-4" />
                      Control de Souvenirs
                    </Button>
                  </li>
                  <li>
                    <Button
                      variant={activeTab === "prices" ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => {
                        setActiveTab("prices")
                        setMobileMenuOpen(false)
                      }}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Configuración de Precios
                    </Button>
                  </li>
                </ul>
              </nav>
              
              <div className="p-4 border-t mt-auto">
                <Button asChild variant="outline" className="w-full">
                  <Link href="/" onClick={() => setMobileMenuOpen(false)}>
                    Ir al sitio público
                  </Link>
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Main content */}
        <div className="flex-1 p-4 md:p-8">
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold ml-8">Panel de Control</h1>
                <Button onClick={handleRefresh} variant="outline" size="sm">
                  <Loader2 className="h-4 w-4 mr-2" />
                  Actualizar datos
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Total de Inscritos</CardTitle>
                    <CardDescription>Personas registradas en el evento</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{totalInscritos}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {cuposDisponibles >= 0 ? `${cuposDisponibles} cupos disponibles` : "¡Cupos excedidos!"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Cupos Autorizados</CardTitle>
                    <CardDescription>Número máximo de participantes permitidos</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{cuposTotales}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {(cuposTotales > 0 ? ((totalInscritos / cuposTotales) * 100).toFixed(1) : "0")}% ocupado
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Souvenirs Entregados</CardTitle>
                    <CardDescription>Artículos entregados a los participantes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{souvenirsEntregados}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {totalInscritos > 0 
                        ? `${((souvenirsEntregados / totalInscritos) * 100).toFixed(1)}% de entregados`
                        : "Sin inscritos aún"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Pendientes de Entrega</CardTitle>
                    <CardDescription>Souvenirs por entregar</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{totalInscritos - souvenirsEntregados}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {souvenirsEntregados > 0 
                        ? `${(((totalInscritos - souvenirsEntregados) / totalInscritos) * 100).toFixed(1)}% pendientes`
                        : "Todos entregados"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Inscripciones por Ruta</CardTitle>
                    <CardDescription>Distribución de cupos por día</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ruta</TableHead>
                          <TableHead className="text-center">Día 1 <br/> Usados/Total</TableHead>
                          <TableHead className="text-center">Día 2 <br/> Usados/Total</TableHead>
                          <TableHead className="text-center">Ocupación</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {routesData.map((route, index) => {
                          const day1Percentage = route.day1Total > 0 ? (route.day1Used / route.day1Total) * 100 : 0
                          const day2Percentage = route.day2Total > 0 ? (route.day2Used / route.day2Total) * 100 : 0
                          const totalPercentage = (route.day1Used + route.day2Used) / (route.day1Total + route.day2Total) * 100

                          return (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{route.name}</TableCell>
                              <TableCell className="text-center">
                                <div>
                                  <div className="font-medium">{route.day1Used} / {route.day1Total}</div>
                                  <div className="text-xs text-gray-500">
                                    {day1Percentage.toFixed(1)}%
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div>
                                  <div className="font-medium">{route.day2Used} / {route.day2Total}</div>
                                  <div className="text-xs text-gray-500">
                                    {day2Percentage.toFixed(1)}%
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="inline-flex items-center">
                                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                    <div 
                                      className="bg-green-600 h-2 rounded-full" 
                                      style={{ width: `${Math.min(totalPercentage, 100)}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm">{totalPercentage.toFixed(1)}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}

                        {routesData.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-gray-500">
                              No hay rutas definidas aún
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle>Acciones Rápidas</CardTitle>
                    <CardDescription>Accesos directos a funciones comunes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button className="w-full justify-start" onClick={() => setActiveTab("payments")}>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Generar nuevo Código
                    </Button>
                    <Button className="w-full justify-start" onClick={() => setActiveTab("routes")}>
                      <Route className="mr-2 h-4 w-4" />
                      Gestión de Rutas
                    </Button>
                    <Button className="w-full justify-start" onClick={() => setActiveTab("people")}>
                      <Users className="mr-2 h-4 w-4" />
                      Gestión de Personas
                    </Button>
                    <Button className="w-full justify-start" onClick={() => setActiveTab("souvenirs")}>
                      <Package className="mr-2 h-4 w-4" />
                      Entrega de Souvenirs ({souvenirsEntregados}/{totalInscritos})
                    </Button>
                    <Button className="w-full justify-start" onClick={() => setActiveTab("prices")}>
                      <Settings className="mr-2 h-4 w-4" />
                      Configuración de precios
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "routes" && <RouteManagement />}
          {activeTab === "people" && <PersonManagement />}
          {activeTab === "payments" && <PaymentControl />}
          {activeTab === "souvenirs" && <SouvenirControl />}
          {activeTab === "prices" && <PriceSettings />}
        </div>
      </div>
    </div>
  )
}