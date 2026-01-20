"use client" // Necesario para el formulario y el redireccionamiento

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar, Users, MapPin, CheckCircle2 } from "lucide-react"
import HeroSection from "@/components/hero-section"
import FeaturedRoutes from "@/components/featured-routes"
import ReservationInfo from "@/components/reservation-info"
import { toast } from "sonner"
import { firebaseClient } from "@/lib/firebase/client" // Importa el cliente de Firebase

export default function Home() {
  // Estados para el formulario
  const [nombre, setNombre] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [loading, setLoading] = useState(false)

  const handleInscripcion = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validar campos
    if (!nombre.trim() || !whatsapp.trim()) {
      toast.error("Por favor completa todos los campos")
      return
    }

    setLoading(true)

    try {
      // 1. Guardar en la base de datos
      const preinscripcionData = {
        nombre: nombre.trim(),
        whatsapp: whatsapp.trim(),
        fecha: new Date().toISOString(),
        tipo: "preinscripcion",
        evento: "II Toma Caminera",
        estado: "pendiente",
        notificado: false
      }

      // Usar el mismo método que en el formulario de inscripciones
      await firebaseClient.createPreinscripcion(preinscripcionData)
      
      toast.success("¡Pre-inscripción exitosa! Te contactaremos pronto.")

      // 2. Crear el mensaje para WhatsApp
      const mensaje = `Hola Caroltur! 👋 Quiero pre-inscribirme a la *II Toma Caminera*. 
      
*Nombre:* ${nombre}
*WhatsApp:* ${whatsapp}

Quedo atento(a) a la información y el itinerario. 🥾`

      const url = `https://wa.me/573216215749?text=${encodeURIComponent(mensaje)}`
      
      // 3. Abrir WhatsApp en una nueva pestaña
      window.open(url, "_blank")

      // 4. Limpiar el formulario
      setNombre("")
      setWhatsapp("")

    } catch (error) {
      console.error("Error al guardar la pre-inscripción:", error)
      toast.error("Hubo un error al procesar tu pre-inscripción. Por favor intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm sticky top-0 z-10" style={{ zIndex: 1000 }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-green-700">
            Caroltur
          </Link>
          <nav className="hidden md:flex space-x-6">
            <Link href="/#rutas" className="text-gray-600 hover:text-green-700">Rutas</Link>
            <Link href="/#reservas" className="text-gray-600 hover:text-green-700">Reservas</Link>
            <Link href="/#inscripcion" className="text-gray-600 hover:text-green-700">Pre-inscripción</Link>
            <Link href="/#programacion" className="text-gray-600 hover:text-green-700">Programación</Link>
          </nav>
          <Button asChild className="bg-green-700 hover:bg-green-800">
            <Link href="/#inscripcion">Inscríbete</Link>
          </Button>
        </div>
      </header>

      <main>
        <HeroSection />

        <section id="rutas" className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="flex items-center mb-8">
              <MapPin className="w-6 h-6 text-green-700 mr-2" />
              <h2 className="text-3xl font-bold">Rutas Destacadas</h2>
            </div>
            <FeaturedRoutes />
          </div>
        </section>

        {/* --- NUEVA SECCIÓN DE FORMULARIO DE CAPTACIÓN --- */}
        <section id="inscripcion" className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto bg-green-50 rounded-3xl overflow-hidden shadow-xl flex flex-col md:flex-row">
              <div className="p-8 md:p-12 md:w-1/2 bg-green-700 text-white flex flex-col justify-center">
                <h2 className="text-3xl font-bold mb-6">Pre-inscríbete a la II Toma Caminera</h2>
                <ul className="space-y-4">
                  <li className="flex items-center"><CheckCircle2 className="mr-2 h-5 w-5 text-green-300" /> Prioridad en asignación de cupos</li>
                  <li className="flex items-center"><CheckCircle2 className="mr-2 h-5 w-5 text-green-300" /> Itinerario detallado en PDF</li>
                  <li className="flex items-center"><CheckCircle2 className="mr-2 h-5 w-5 text-green-300" /> Tarifas especiales para grupos</li>
                </ul>
                <p className="mt-8 text-green-100 text-sm italic"> Carolina del Príncipe te espera para vivir el Jardín Colonial de América desde sus montañas. </p>
              </div>
              
              <div className="p-8 md:p-12 md:w-1/2">
                <form onSubmit={handleInscripcion} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                    <Input 
                      value={nombre} 
                      onChange={(e) => setNombre(e.target.value)} 
                      placeholder="Ej. Juan Pérez" 
                      required 
                      className="mt-1"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">WhatsApp</label>
                    <Input 
                      type="tel" 
                      value={whatsapp} 
                      onChange={(e) => setWhatsapp(e.target.value)} 
                      placeholder="Ej. 3216215749" 
                      required 
                      className="mt-1"
                      disabled={loading}
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-green-700 hover:bg-green-800 text-white py-6"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Guardando...
                      </>
                    ) : (
                      "Enviar y Recibir Información"
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </section>

        <section id="reservas" className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="flex items-center mb-8">
              <Users className="w-6 h-6 text-green-700 mr-2" />
              <h2 className="text-3xl font-bold">Información de Reservas</h2>
            </div>
            <ReservationInfo />
          </div>
        </section>

        <section id="programacion" className="py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center mb-8">
              <Calendar className="w-6 h-6 text-green-700 mr-2" />
              <h2 className="text-3xl font-bold">Programación del Evento</h2>
            </div>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-yellow-700 font-medium">Cronograma detallado próximamente. ¡Pre-inscríbete para ser el primero en recibirlo!</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-green-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">Caroltur</h3>
              <p className="text-green-100">Carolina Mágica Senderos y Cascadas. Turismo de aventura y naturaleza con sentido local.</p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4">Enlaces Rápidos</h3>
              <ul className="space-y-2">
                <li><Link href="/#rutas" className="hover:text-green-300">Rutas</Link></li>
                <li><Link href="/#reservas" className="hover:text-green-300">Reservas</Link></li>
                <li><Link href="/#inscripcion" className="hover:text-green-300">Inscripción</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4">Contacto Directo</h3>
              <p>📍 Carolina del Príncipe, Antioquia</p>
              <p>✉️ caroltur.com@gmail.com</p>
              <p>📞 3216215749</p>
            </div>
          </div>
          <div className="border-t border-green-700 mt-12 pt-8 text-center text-sm text-green-200">
            <p>&copy; {new Date().getFullYear()} Caroltur. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}