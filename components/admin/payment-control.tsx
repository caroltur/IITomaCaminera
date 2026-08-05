"use client"

import { useState, useEffect } from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Edit, Trash2, Copy, Users, User, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { firebaseClient } from "@/lib/firebase/client"

// Esquemas de validación
const generateCodeSchema = z.object({
  document_id: z.string().min(5, "El número de documento debe tener al menos 5 caracteres"),
  people_count: z.coerce.number().min(1, "Debe haber al menos 1 persona").max(50, "Máximo 50 personas por grupo"),
  payment_number: z.string().min(1, "El número del comprobante es requerido"),
  account_holder: z.enum(["Freiman Stiven Martinez Quintana", "Juan Manuel Arango Arango"], {
    errorMap: () => ({ message: "Debes seleccionar un titular de la cuenta" })
  }),
})

const editPeopleSchema = z.object({
  people_count: z.coerce.number().min(1, "Debe haber al menos 1 persona").max(50, "Máximo 50 personas por grupo"),
  payment_number: z.string().min(1, "El número del comprobante es requerido"),
})

// Tipos
type AccessCode = {
  id: string
  document_id: string
  people_count: number
  access_code: string
  is_group: boolean
  payment_number: string
  account_holder: "Freiman Stiven Martinez Quintana" | "Juan Manuel Arango Arango"
  status: "pending" | "paid" | "used"
  created_at: string
  updated_at: string
  payment_images?: string[]
}

export default function PaymentControl() {
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedAccessCode, setSelectedAccessCode] = useState<AccessCode | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  // Formularios
  const generateForm = useForm<z.infer<typeof generateCodeSchema>>({
    resolver: zodResolver(generateCodeSchema),
    defaultValues: {
      document_id: "",
      people_count: 1,
      payment_number: "",
      account_holder: "Freiman Stiven Martinez Quintana",
    },
  })

  const editForm = useForm<z.infer<typeof editPeopleSchema>>({
    resolver: zodResolver(editPeopleSchema),
    defaultValues: {
      people_count: 1,
      payment_number: "",
    },
  })

  useEffect(() => {
    loadAccessCodes()
  }, [])

  const loadAccessCodes = async () => {
    setLoading(true)
    try {
      const codes = await firebaseClient.getAccessCodes()
      setAccessCodes(Array.isArray(codes) ? codes : [])
    } catch (error) {
      console.error("Error loading codes:", error)
      toast.error("Error al cargar los códigos")
      setAccessCodes([])
    } finally {
      setLoading(false)
    }
  }

  const generateAccessCode = async (data: z.infer<typeof generateCodeSchema>) => {
    setSubmitting(true)
    try {
      const existingCode = await firebaseClient.getAccessCodeByDocument(data.document_id)
      if (existingCode) {
        toast.error("Ya existe un código para este documento")
        return
      }

      // ✅ CORREGIDO: Generar el código alfanumérico (IND-123456 o GRP-123456)
      const prefix = data.people_count > 1 ? "GRP" : "IND"
      const randomNum = Math.floor(100000 + Math.random() * 900000)
      const newAccessCode = `${prefix}-${randomNum}`

      const createdAccessCodeData = await firebaseClient.createAccessCode({
        ...data,
        access_code: newAccessCode, // ✅ Añadido al payload
        payment_images: [],
        is_group: data.people_count > 1,
        status: "pending" as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      setAccessCodes((prev) => [createdAccessCodeData as AccessCode, ...prev])
      generateForm.reset()
      toast.success("Código generado exitosamente")
    } catch (error) {
      console.error("Error generating code:", error)
      toast.error("Error al generar el código")
    } finally {
      setSubmitting(false)
    }
  }

  const updateAccessCodeData = async (data: z.infer<typeof editPeopleSchema>) => {
    if (!selectedAccessCode) return
    try {
      const updatedValues = {
        people_count: data.people_count,
        payment_number: data.payment_number,
        is_group: data.people_count > 1,
        updated_at: new Date().toISOString()
      }

      await firebaseClient.updateAccessCode(selectedAccessCode.id, updatedValues)

      // Sincronizar con el grupo si existe
      const group = await firebaseClient.getGroupByLeaderDocument(selectedAccessCode.document_id)
      if (group) {
        await firebaseClient.updateGroup(group.id, { member_count: data.people_count })
      }

      setAccessCodes(accessCodes.map((code) => 
        code.id === selectedAccessCode.id ? { ...code, ...updatedValues } : code
      ))

      setIsEditDialogOpen(false)
      toast.success("Información actualizada")
    } catch (error) {
      console.error("Error updating code:", error)
      toast.error("Error al actualizar")
    }
  }

  const deleteAccessCode = async () => {
    if (!selectedAccessCode) return
    try {
      await firebaseClient.deleteAccessCode(selectedAccessCode.id)
      setAccessCodes(accessCodes.filter((code) => code.id !== selectedAccessCode.id))
      setIsDeleteDialogOpen(false)
      toast.success("Código eliminado")
    } catch (error) {
      console.error("Error deleting code:", error)
      toast.error("Error al eliminar")
    }
  }

  // ✅ NUEVA FUNCIÓN: Copiar instrucciones formateadas tipo planilla
  const copyInstructionsToClipboard = async (code: AccessCode) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
    
    const text = `¡Hola! 👋

Tu código de confirmación para el evento ha sido generado exitosamente.

📝 *INSTRUCCIONES PARA COMPLETAR TU INSCRIPCIÓN:*
1. Ingresa al enlace de inscripción: ${baseUrl}/inscripcion
2. En el primer paso, ingresa tu número de documento: *${code.document_id}*
3. Ingresa tu código de acceso: *${code.access_code}*
4. Haz clic en "Verificar Código".
5. Completa tus datos personales (Nombre, Teléfono, RH) y selecciona tus rutas.
6. Haz clic en "Completar Inscripción".

⚠️ *IMPORTANTE:*
• Este código es personal e intransferible.
• Si eres líder de grupo, deberás registrar los datos de todos tus caminantes después de verificar este código.
• Guarda este mensaje para futuras referencias.

¡Te esperamos en la aventura! 🏔️`

    try {
      await navigator.clipboard.writeText(text)
      toast.success("Instrucciones copiadas al portapapeles ✅")
    } catch (error) {
      console.error("Error copying to clipboard:", error)
      toast.error("Error al copiar al portapapeles")
    }
  }

  const openEditDialog = (accessCode: AccessCode) => {
    setSelectedAccessCode(accessCode)
    editForm.reset({
      people_count: accessCode.people_count,
      payment_number: accessCode.payment_number || "",
    })
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (accessCode: AccessCode) => {
    setSelectedAccessCode(accessCode)
    setIsDeleteDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "border-yellow-500 text-yellow-500",
      paid: "bg-green-500",
      used: "bg-blue-500"
    }
    return (
      <Badge variant={status === "pending" ? "outline" : "default"} className={styles[status] || ""}>
        {status === "pending" ? "Pendiente" : status === "paid" ? "Pagado" : "Usado"}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold ml-8">Control de Pagos y Códigos</h1>
        <div className="text-sm text-gray-500">Total: {accessCodes.length}</div>
      </div>

      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="generate">Generar Código</TabsTrigger>
          <TabsTrigger value="manage">Gestionar Códigos</TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle>Generar Nuevo Código</CardTitle>
              <CardDescription>Crea un código de acceso para un participante o grupo.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...generateForm}>
                <form onSubmit={generateForm.handleSubmit(generateAccessCode)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={generateForm.control} name="document_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Documento Responsable *</FormLabel>
                        <FormControl><Input placeholder="Ej. 1234567890" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={generateForm.control} name="people_count" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cant. Personas *</FormLabel>
                        <FormControl><Input type="number" min={1} max={50} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={generateForm.control} name="payment_number" render={({ field }) => (
                      <FormItem>
                        <FormLabel>N° Comprobante *</FormLabel>
                        <FormControl><Input placeholder="Referencia bancaria o Nequi" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={generateForm.control} name="account_holder" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Titular Cuenta *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Freiman Stiven Martinez Quintana">Freiman Martinez</SelectItem>
                            <SelectItem value="Juan Manuel Arango Arango">Juan Arango</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {submitting ? "Generando..." : "Crear Código de Acceso"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Comprobante</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-green-600" />
                        <p className="mt-2 text-gray-500">Cargando códigos...</p>
                      </TableCell>
                    </TableRow>
                  ) : accessCodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No hay códigos generados aún.
                      </TableCell>
                    </TableRow>
                  ) : (
                    accessCodes.map((code) => (
                      <TableRow key={code.id}>
                        <TableCell className="font-medium">{code.document_id}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{code.access_code}</code>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            {code.is_group ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                            {code.is_group ? `Grupo (${code.people_count})` : "Individual"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{code.payment_number}</TableCell>
                        <TableCell>{getStatusBadge(code.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {/* ✅ NUEVO: Botón dedicado para copiar las instrucciones formateadas */}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => copyInstructionsToClipboard(code)}
                              title="Copiar instrucciones de registro para enviar al usuario"
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              <span className="hidden sm:inline">Copiar Instrucciones</span>
                            </Button>
                            
                            {code.is_group && (
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(code)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(code)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo de Edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Grupo</DialogTitle>
            <DialogDescription>Actualiza los datos de pago y asistencia del grupo.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(updateAccessCodeData)} className="space-y-4">
              <FormField control={editForm.control} name="people_count" render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de personas</FormLabel>
                  <FormControl><Input type="number" min={1} max={50} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="payment_number" render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Comprobante</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">Guardar Cambios</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Eliminación */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar código?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El participante perderá su acceso.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={deleteAccessCode}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}