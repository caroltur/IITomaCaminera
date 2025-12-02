import Link from "next/link"
import { Button } from "@/components/ui/button"
import {  Calendar, Users } from "lucide-react"
import HeroSection from "@/components/hero-section"
import FeaturedRoutes from "@/components/featured-routes"
//import EventSchedule from "@/components/event-schedule"
import ReservationInfo from "@/components/reservation-info"

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm sticky top-0 z-10" style={{zIndex: 1000}}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-green-700">
            Carolina del Príncipe
          </Link>
          <nav className="hidden md:flex space-x-6">
            <Link href="/#rutas" className="text-gray-600 hover:text-green-700">
              Rutas
            </Link>
            <Link href="/#reservas" className="text-gray-600 hover:text-green-700">
              Reservas
            </Link>
            <Link href="/#programacion" className="text-gray-600 hover:text-green-700">
              Programación
            </Link>
            <Link href="/inscripcion" className="text-green-700 font-medium hover:text-green-800">
              Inscríbete
            </Link>
          </nav>
          <Button asChild className="md:hidden bg-green-700 hover:bg-green-800">
            <Link href="/inscripcion">Inscríbete</Link>
          </Button>
        </div>
      </header>
      
      <main>
        <HeroSection />

        <section id="rutas" className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            
            <FeaturedRoutes />
            
          </div>
        </section>

        <section id="reservas" className="py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center mb-8">
              <Users className="w-6 h-6 text-green-700 mr-2" />
              <h2 className="text-3xl font-bold">Información de Reservas</h2>
            </div>
            <ReservationInfo />
          </div>
        </section>

        <section id="programacion" className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="flex items-center mb-8">
              <Calendar className="w-6 h-6 text-green-700 mr-2" />
              <h2 className="text-3xl font-bold">Programación del Evento</h2>
            </div>
            Pendiente...
            {/*<EventSchedule />*/}
          </div>
        </section>
      </main>

      <footer className="bg-green-800 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">II Toma Caminera en Carolina del Príncipe</h3>
              <p>Carolina Mágica Senderos y Cascadas.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4">Enlaces</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/#rutas" className="hover:underline">
                    Rutas
                  </Link>
                </li>
                <li>
                  <Link href="/#reservas" className="hover:underline">
                    Reservas
                  </Link>
                </li>
                <li>
                  <Link href="/#programacion" className="hover:underline">
                    Programación
                  </Link>
                </li>
                <li>
                  <Link href="/inscripcion" className="hover:underline">
                    Inscripción
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4">Contacto</h3>
              <p>Email: caroltur.com@gmail.com</p>
              <p>Teléfono: 3216215749</p>
            </div>
          </div>
          <div className="border-t border-green-700 mt-8 pt-4 text-center">
            <p>&copy; {new Date().getFullYear()} Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
