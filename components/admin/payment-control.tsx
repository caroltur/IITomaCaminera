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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
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
import { Edit, Trash2, Copy, CheckCircle, Users, User, Upload } from "lucide-react"
import { toast } from "sonner"
import { firebaseClient } from "@/lib/firebase/client"

// Esquemas de validación
const generateCodeSchema = z.object({
  document_id: z.string().min(5, "El número de documento debe tener al menos 5 caracteres"),
  people_count: z.coerce.number().min(1, "Debe haber al menos 1 persona").max(20, "Máximo 20 personas por grupo"),
  payment_number: z.string().min(1, "El número del comprobante es requerido"),
  account_holder: z.enum(["Freiman Stiven Martinez Quintana", "Juan Manuel Arango Arango"], {
    errorMap: () => ({ message: "Debes seleccionar un titular de la cuenta" })
  }),
})

// Esquema de edición actualizado (Punto 2: Agregado payment_number)
const editPeopleSchema = z.object({
  people_count: z.coerce.number().min(1, "Debe haber al menos 1 persona").max(20, "Máximo 20 personas por grupo"),
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

      const createdAccessCodeData = await firebaseClient.createAccessCode({
        ...data,
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
      toast.error("Error al generar el código")
    } finally {
      setSubmitting(false)
    }
  }

  // Función de actualización (Punto 2: Actualiza personas y comprobante)
  const updateAccessCodeData = async (data: z.infer<typeof editPeopleSchema>) => {
    
    if (!selectedAccessCode) return
    try {
      const updatedValues = {
        people_count: data.people_count,
        payment_number: data.payment_number,
        is_group: data.people_count > 1,
        updated_at: new Date().toISOString()
      }

      //console.log("Actualizando grupo asociado:", group.id)
        console.log("Nuevos datos:", selectedAccessCode.document_id)

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
      toast.error("Error al eliminar")
    }
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    toast.success("Copiado")
  }

  const openEditDialog = (accessCode: AccessCode) => {
    setSelectedAccessCode(accessCode)
    // Cargar valores actuales en el formulario
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

  // Helpers de UI
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "border-yellow-500 text-yellow-500",
      paid: "bg-green-500",
      used: "bg-blue-500"
    }
    return <Badge variant={status === "pending" ? "outline" : "default"} className={styles[status] || ""}>
      {status === "pending" ? "Pendiente" : status === "paid" ? "Pagado" : "Usado"}
    </Badge>
  }

  const getShortAccountHolder = (fullName: string) => {
    return fullName.includes("Freiman") ? "Freiman Martinez" : "Juan Arango"
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold ml-8">Control de Pagos</h1>
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
            </CardHeader>
            <CardContent>
              <Form {...generateForm}>
                <form onSubmit={generateForm.handleSubmit(generateAccessCode)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={generateForm.control} name="document_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Documento Responsable *</FormLabel>
                        <FormControl><Input placeholder="Ej. 123456" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={generateForm.control} name="people_count" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cant. Personas *</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={generateForm.control} name="payment_number" render={({ field }) => (
                      <FormItem>
                        <FormLabel>N° Comprobante *</FormLabel>
                        <FormControl><Input placeholder="Referencia bancaria" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={generateForm.control} name="account_holder" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Titular Cuenta *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                    <TableRow><TableCell colSpan={6} className="text-center">Cargando...</TableCell></TableRow>
                  ) : accessCodes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell>{code.document_id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted p-1">{code.access_code}</code>
                          <Copy className="h-3 w-3 cursor-pointer" onClick={() => copyToClipboard(code.access_code)} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {code.is_group ? <Users className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                          {code.is_group ? `Grupo (${code.people_count})` : "Individual"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{code.payment_number}</TableCell>
                      <TableCell>{getStatusBadge(code.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {/* PUNTO 1: Solo se editan grupos */}
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
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo de Edición (Punto 2: Personas + Comprobante) */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Grupo</DialogTitle>
            <DialogDescription>Actualiza los datos de pago y asistencia.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(updateAccessCodeData)} className="space-y-4">
              <FormField control={editForm.control} name="people_count" render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de personas</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
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
            <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
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