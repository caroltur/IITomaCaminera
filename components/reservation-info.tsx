"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, Send, Info, CheckCircle, Phone } from "lucide-react"
import { firebaseClient } from "@/lib/firebase/client"

type Settings = {
  registration_price: number
  bank_name: string
  account_type: string
  account_number: string
  account_holder: string
  nit: string
  whatsapp_number: string
  payment_instructions: string
}

export default function ReservationInfo() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const data = await firebaseClient.getSettings()
      setSettings(data)
    } catch (error) {
      console.error("Error fetching settings:", error)
      // Fallback data
      setSettings({
        registration_price: 50000,
        bank_name: "Banco Nacional",
        account_type: "Ahorros",
        account_number: "123-456789-0",
        account_holder: "Evento Caminera S.A.S.",
        nit: "900.123.456-7",
        whatsapp_number: "+57 300 123 4567",
        payment_instructions: "Envía una foto del comprobante de pago al WhatsApp junto con tu número de cédula.",
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-300 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-4 bg-gray-300 rounded"></div>
                <div className="h-4 bg-gray-300 rounded w-2/3"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No se pudo cargar la información de reservas.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="mr-2 h-5 w-5 text-green-700" />
            Proceso de Inscripción
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="bg-green-100 text-green-700 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                1
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Realizar el Pago</h4>
                <p className="text-gray-600 text-sm mb-3">
                  Haz la consignación del valor de inscripción a nuestra cuenta bancaria.
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-green-800 font-semibold text-lg">
                    ${settings.registration_price.toLocaleString()} COP
                  </p>
                  <p className="text-green-700 text-sm">Por persona</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-green-800 font-semibold text-lg">
                    $80.000 COP
                  </p>
                  <p className="text-green-700 text-sm">Por persona para grupos de mas de 12 personas</p>
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-green-100 text-green-700 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                2
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Enviar Comprobante por WhatsApp</h4>
                <p className="text-gray-600 text-sm mb-3">
                  Envía el comprobante de pago junto con la siguiente información:
                </p>
                <ul className="text-gray-600 text-sm space-y-1 ml-4 list-disc">
                  <li>Número de documento de quien realizó el pago</li>
                  <li>
                    Indicar si se inscriben como <strong>grupo</strong> o <strong>independientes</strong>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-green-100 text-green-700 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                3
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Recibir Código de Confirmación</h4>
                <p className="text-gray-600 text-sm mb-3">
                  Una vez verificado el pago, recibirás un código único que usarás para completar tu inscripción.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-green-100 text-green-700 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                4
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Completar Inscripción</h4>
                <p className="text-gray-600 text-sm">
                  Usa tu número de cédula y código de confirmación para finalizar el proceso de inscripción.
                </p>
              </div>
            </div>
          </div>
          
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center">
            <CreditCard className="mr-2 h-5 w-5 text-green-700" />
            Información de Pago
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Datos Bancarios</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Banco:</span>
                <span className="font-medium">{settings.bank_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tipo de cuenta:</span>
                <span className="font-medium">{settings.account_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Número:</span>
                <span className="font-medium">{settings.account_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Titular:</span>
                <span className="font-medium">{settings.account_holder}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cédula:</span>
                <span className="font-medium">{settings.nit}</span>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold flex items-center mb-3">
              <Send className="mr-2 h-4 w-4 text-green-700" />
              Envío de Comprobante
            </h3>
            <p className="text-gray-700 text-sm mb-3">{settings.payment_instructions}</p>
            <div className="flex items-center space-x-2">
              <Phone className="h-4 w-4 text-green-700" />
              <span className="font-semibold text-green-700">{settings.whatsapp_number}</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold flex items-center mb-2">
              <CheckCircle className="mr-2 h-4 w-4 text-blue-700" />
              Información Importante
            </h3>
            <ul className="text-blue-800 text-sm space-y-1 list-disc list-inside">
              <li>
                <strong>Si es GRUPO:</strong> Solo necesitas enviar el número de documento del líder del grupo.
              </li>
              <li>
                <strong>Si son INDEPENDIENTES:</strong> Debes compartir los números de cédula de cada persona que hizo
                la consignación.
              </li>
              <li>Sin el comprobante de pago y la información solicitada, no podremos procesar tu inscripción.</li>
            </ul>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold flex items-center mb-2">
              <CheckCircle className="mr-2 h-4 w-4 text-red-700" />
              Incluye
            </h3>
            <ul className="text-red-800 text-sm space-y-1 list-disc list-inside">
              <li>
                SEGURO contra accidentes los dos días de caminata.
              </li>
              <li>
                Transporte rural.
              </li>
              <li>Refrigerios.</li>
              <li>Souvenir.</li>
              <li>Guianza.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
