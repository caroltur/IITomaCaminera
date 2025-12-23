"use client"
import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, MapPin, Mountain, Users, Ruler, ChevronLeft, ChevronRight } from "lucide-react"
import { firebaseClient } from "@/lib/firebase/client"

type DaySpots = {
  day: number
  spots: number
}



type Route = {
  id: string
  name: string
  description: string
  difficulty: "Fácil" | "Moderada" | "Difícil"
  image_url: string
  available_spots_by_day: DaySpots[]
  duration: string
  distance: string
  elevation: string
  meeting_point: string
  gallery: string
}

export default function RouteDetailPage() {
  const params = useParams()
  const [route, setRoute] = useState<Route | null>(null)
  const [loading, setLoading] = useState(true)
  const [availableSpots, setAvailableSpots] = useState<DaySpots[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)

  useEffect(() => {
    if (params.id) {
      fetchRoute(params.id as string)
    }
  }, [params.id])

  const fetchRoute = async (id: string) => {
    try {
      const data = await firebaseClient.getRouteById(id)
      if (data) {
        setRoute(data)
        const registeredByDay = await firebaseClient.getAvailableSpotsByRoute(id)
        const availableSpotsByDay = data.available_spots_by_day.map((daySpot: { day: number; spots: number }) => ({
          day: daySpot.day,
          spots: Math.max(0, daySpot.spots - (registeredByDay[daySpot.day] || 0)),
        }))
        setAvailableSpots(availableSpotsByDay)
      }
    } catch (error) {
      console.error("Error fetching route:", error)
      setRoute({
        id: "1",
        name: "Sendero del Bosque",
        description:
          "Un recorrido tranquilo a través de un hermoso bosque con vistas panorámicas.",
        difficulty: "Fácil",
        image_url: "/placeholder.svg?height=400&width=800",
        available_spots_by_day: [
          { day: 1, spots: 25 },
          { day: 2, spots: 20 },
        ],
        duration: "3 horas",
        distance: "5 km",
        elevation: "150 m",
        meeting_point: "Parque Central, entrada principal",
        gallery: "https://example.com/gallery"
      })
      setAvailableSpots([
        { day: 1, spots: 23 },
        { day: 2, spots: 18 },
      ])
    } finally {
      setLoading(false)
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Fácil": return "bg-green-500 text-white"
      case "Moderada": return "bg-yellow-500 text-white"
      case "Difícil": return "bg-red-500 text-white"
      default: return "bg-gray-500 text-white"
    }
  }

  const getTotalAvailableSpots = () => {
    return availableSpots.reduce((total, day) => total + day.spots, 0)
  }

  

  

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-300 rounded w-1/3"></div>
            <div className="h-64 bg-gray-300 rounded"></div>
            <div className="h-4 bg-gray-300 rounded w-full"></div>
            <div className="h-4 bg-gray-300 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!route) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Ruta no encontrada</h1>
          <Link href="/rutas">
            <Button variant="outline">Volver a Rutas</Button>
          </Link>
        </div>
      </div>
    )
  }

  

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/rutas" className="flex items-center text-green-600 hover:text-green-800 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Volver a rutas
      </Link>

      <div className="relative h-[400px] rounded-xl overflow-hidden mb-6">
        <Image src={route.image_url} alt={route.name} fill className="object-cover" />
        <div className="absolute inset-0 bg-black flex items-end">
          <div className="p-6 text-white">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">{route.name}</h1>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getDifficultyColor(route.difficulty)}`}>
                {route.difficulty}
              </span>
              <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-blue-500 text-white">
                {route.distance} km
              </span>
              <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-purple-500 text-white">
                {route.duration} Horas
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Tabs defaultValue="descripcion">
            <TabsList className="mb-4">
              <TabsTrigger value="descripcion">Descripción</TabsTrigger>
                <a href={route.gallery} target="_blank" rel="noopener noreferrer">Galería</a>
            </TabsList>
            <TabsContent value="descripcion" className="space-y-4">
              <p className="text-lg">{route.description}</p>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-gray-500" />
                  <span>{route.duration} Horas</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-gray-500" />
                  <span>{route.meeting_point}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Ruler className="h-5 w-5 text-gray-500" />
                  <span>{route.distance} Km</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mountain className="h-5 w-5 text-gray-500" />
                  <span>{route.elevation} metros</span>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="galeria">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
               
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-4">Disponibilidad</h3>
              <div className="space-y-6">
                {availableSpots.map((daySpot) => (
                  <div key={daySpot.day}>
                    <h4 className="font-semibold mb-2">Día {daySpot.day}</h4>
                    <div className="flex justify-between items-center mb-2">
                      <p>Cupos disponibles: {daySpot.spots}/{route.available_spots_by_day.find(d => d.day === daySpot.day)?.spots}</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${100 - (daySpot.spots / route.available_spots_by_day.find(d => d.day === daySpot.day)?.spots!) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <Link href="/inscripcion">
                  <Button className="w-full">Inscribirme</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      
    </div>
  )
}