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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ImageIcon, Eye, Trash2, Plus, Upload, Edit, Copy, CheckCircle, Users, User } from "lucide-react"
import { toast } from "sonner"
import { firebaseClient } from "@/lib/firebase/client"

// Esquemas de validación
const generateCodeSchema = z.object({
  document_id: z.string().min(5, "El número de documento debe tener al menos 5 caracteres"),
  people_count: z.coerce.number().min(1, "Debe haber al menos 1 persona").max(20, "Máximo 20 personas por grupo"),
  // ✅ NUEVO: Campos adicionales obligatorios
  payment_number: z.string().min(1, "El número del comprobante es requerido"),
  account_holder: z.enum(["Freiman Stiven Martinez Quintana", "Juan Manuel Arango Arango"], {
    errorMap: () => ({ message: "Debes seleccionar un titular de la cuenta" })
  }),
})

const addImageSchema = z.object({
  image_file: typeof window !== 'undefined' ? z.instanceof(File, { message: "Selecciona una imagen válida" }) : z.any(),
})

const editPeopleSchema = z.object({
  people_count: z.coerce.number().min(1, "Debe haber al menos 1 persona").max(20, "Máximo 20 personas por grupo"),
})

// Tipos
type AccessCode = {
  id: string
  document_id: string
  people_count: number
  access_code: string
  is_group: boolean
  // ✅ NUEVO: Campos adicionales en el tipo
  payment_number: string
  account_holder: "Freiman Stiven Martinez Quintana" | "Juan Manuel Arango Arango"
  status: "pending" | "paid"
  created_at: string
  updated_at: string
}

export default function PaymentControl() {
  // Estados principales
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [lastGeneratedCode, setLastGeneratedCode] = useState<string | null>(null)

  // Estados para diálogos
  const [selectedAccessCode, setSelectedAccessCode] = useState<AccessCode | null>(null)
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Formularios
  const generateForm = useForm<z.infer<typeof generateCodeSchema>>({
    resolver: zodResolver(generateCodeSchema),
    defaultValues: {
      document_id: "",
      people_count: 1,
      // ✅ NUEVO: Valores por defecto para los nuevos campos
      payment_number: "",
      account_holder: undefined, // No hay opción pre-seleccionada
    },
  })

  const imageForm = useForm<z.infer<typeof addImageSchema>>({
    resolver: zodResolver(addImageSchema),
  })

  const editForm = useForm<z.infer<typeof editPeopleSchema>>({
    resolver: zodResolver(editPeopleSchema),
    defaultValues: {
      people_count: 1,
    },
  })

  // Cargar códigos iniciales
  useEffect(() => {
    loadAccessCodes()
  }, [])

  const loadAccessCodes = async () => {
    setLoading(true)
    try {
      const codes = await firebaseClient.getAccessCodes()
      setAccessCodes(Array.isArray(codes) ? codes : [])
    } catch (error) {
      console.error("Error loading access codes:", error)
      toast.error("Error al cargar los códigos de acceso")
      setAccessCodes([])
    } finally {
      setLoading(false)
    }
  }

  // ✅ CORREGIDO: Función generateAccessCode con todos los campos
  const generateAccessCode = async (data: z.infer<typeof generateCodeSchema>) => {
    setSubmitting(true);
    try {
      const existingCode = await firebaseClient.getAccessCodeByDocument(data.document_id);
      if (existingCode) {
        toast.error("Ya existe un código de acceso para este número de documento");
        return;
      }

      // ✅ AHORA SÍ: Incluir el account_holder en los datos enviados a Firebase
      const createdAccessCodeData = await firebaseClient.createAccessCode({
        document_id: data.document_id,
        people_count: data.people_count,
        // ✅ CORRECCIÓN: Asegurarse de enviar account_holder
        payment_number: data.payment_number,
        account_holder: data.account_holder, // <-- ¡Este estaba faltando!
        // Campos por defecto
        payment_images: [],
        is_group: data.people_count > 1,
        status: "pending" as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const newAccessCode: AccessCode = createdAccessCodeData as AccessCode;

      setAccessCodes((prevAccessCodes) => [newAccessCode, ...prevAccessCodes]);
      setLastGeneratedCode(newAccessCode.access_code);
      generateForm.reset();
      toast.success(`Código generado exitosamente: ${newAccessCode.access_code}`);
    } catch (error) {
      console.error("Error generating access code:", error);
      toast.error("Error al generar el código de acceso");
    } finally {
      setSubmitting(false);
    }
  };

  // Actualizar número de personas
  const updatePeopleCount = async (data: z.infer<typeof editPeopleSchema>) => {
    if (!selectedAccessCode) return
    try {
      const updatedData = {
        people_count: data.people_count,
        is_group: data.people_count > 1,
        updated_at: new Date().toISOString()
      }

      await firebaseClient.updateAccessCode(selectedAccessCode.id, updatedData)

      const group = await firebaseClient.getGroupByLeaderDocument(selectedAccessCode.document_id)

      if (group) {
        await firebaseClient.updateGroup(group.id, {
          member_count: data.people_count,
        })
      }
      const updatedAccessCode = {
        ...selectedAccessCode,
        ...updatedData,
      }

      setSelectedAccessCode(updatedAccessCode)
      setAccessCodes(
        accessCodes.map((code) =>
          code.id === selectedAccessCode.id ? updatedAccessCode : code
        )
      )

      setIsEditDialogOpen(false)
      toast.success(`Número de personas actualizado a ${data.people_count}`)
    } catch (error) {
      console.error("Error updating people count:", error)
      toast.error("Error al actualizar el número de personas")
    }
  }

  // Eliminar código
  const deleteAccessCode = async () => {
    if (!selectedAccessCode) return
    try {
      await firebaseClient.deleteAccessCode(selectedAccessCode.id)
      setAccessCodes(accessCodes.filter((code) => code.id !== selectedAccessCode.id))
      setIsDeleteDialogOpen(false)
      setSelectedAccessCode(null)
      toast.success("Código de acceso eliminado exitosamente")
    } catch (error) {
      console.error("Error deleting access code:", error)
      toast.error("Error al eliminar el código de acceso")
    }
  }

  // Copiar al portapapeles
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Código copiado al portapapeles")
    } catch (error) {
      toast.error("Error al copiar el código")
    }
  }

  // Abrir diálogos
  const openImageDialog = (accessCode: AccessCode) => {
    setSelectedAccessCode(accessCode)
    setIsImageDialogOpen(true)
  }

  const openEditDialog = (accessCode: AccessCode) => {
    setSelectedAccessCode(accessCode)
    editForm.setValue("people_count", accessCode.people_count)
    setIsEditDialogOpen(true)
  }

  const openDeleteDialog = (accessCode: AccessCode) => {
    setSelectedAccessCode(accessCode)
    setIsDeleteDialogOpen(true)
  }

  // Renderizados auxiliares
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-500">
            Pendiente
          </Badge>
        )
      case "paid":
        return <Badge className="bg-green-500">Pagado</Badge>
      case "used":
        return <Badge className="bg-blue-500">Usado</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  const getTypeBadge = (isGroup: boolean, peopleCount: number) => {
    if (isGroup) {
      return (
        <Badge variant="outline" className="border-blue-500 text-blue-500">
          <Users className="h-3 w-3 mr-1" />
          Grupo ({peopleCount})
        </Badge>
      )
    }
    return (
      <Badge variant="outline">
        <User className="h-3 w-3 mr-1" />
        Individual
      </Badge>
    )
  }

  // ✅ NUEVA FUNCIÓN: Obtener el nombre corto del titular para mostrar en la tabla
  const getShortAccountHolder = (fullName: string) => {
    if (fullName === "Freiman Stiven Martinez Quintana") return "Freiman Martinez";
    if (fullName === "Juan Manuel Arango Arango") return "Juan Arango";
    return fullName;
  }

  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold ml-8">Control de Pagos</h1>
        <div className="text-sm text-gray-500">
          Total de códigos: {(accessCodes || []).length}
        </div>
      </div>

      {/* Pestañas */}
      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="generate">Generar Código</TabsTrigger>
          <TabsTrigger value="manage">Gestionar Códigos ({(accessCodes || []).length})</TabsTrigger>
        </TabsList>

        {/* Tab: Generar Código */}
        <TabsContent value="generate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generar Nuevo Código de Acceso</CardTitle>
              <CardDescription>
                Crea un código único para que las personas puedan completar su inscripción después de realizar el pago.
                <span className="block mt-1 text-red-500 font-medium">* Todos los campos son obligatorios</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...generateForm}>
                <form onSubmit={generateForm.handleSubmit(generateAccessCode)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={generateForm.control}
                      name="document_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Documento *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej. 1234567890" {...field} disabled={submitting} />
                          </FormControl>
                          <FormDescription>Documento de la persona responsable del pago</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={generateForm.control}
                      name="people_count"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Personas *</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" max="20" {...field} disabled={submitting} />
                          </FormControl>
                          <FormDescription>1 = Individual, 2+ = Grupo (máximo 20)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* ✅ NUEVO: Campos adicionales obligatorios */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={generateForm.control}
                      name="payment_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número del Comprobante *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Ej. 001-1234567" 
                              {...field} 
                              disabled={submitting} 
                            />
                          </FormControl>
                          <FormDescription>Número del comprobante de pago bancario</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={generateForm.control}
                      name="account_holder"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Titular de la Cuenta *</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                            disabled={submitting}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un titular" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Freiman Stiven Martinez Quintana">
                                Freiman Stiven Martinez Quintana
                              </SelectItem>
                              <SelectItem value="Juan Manuel Arango Arango">
                                Juan Manuel Arango Arango
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>Cuenta bancaria donde se realizó el pago</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? (
                      <>
                        <Upload className="mr-2 h-4 w-4 animate-spin" />
                        Generando código...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Generar Código de Acceso
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Gestionar Códigos */}
        <TabsContent value="manage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Códigos de Acceso Generados</CardTitle>
              <CardDescription>Gestiona los códigos existentes con toda la información de pago.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Comprobante</TableHead>
                      <TableHead>Titular</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <div className="flex items-center justify-center">
                            <Upload className="mr-2 h-4 w-4 animate-spin" />
                            Cargando códigos...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : accessCodes && accessCodes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <div className="text-gray-500">
                            <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No hay códigos generados aún</p>
                            <p className="text-sm">Usa la pestaña "Generar Código" para crear uno</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      accessCodes.map((accessCode) => (
                        <TableRow key={accessCode.id}>
                          <TableCell className="font-medium">{accessCode.document_id}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                                {accessCode.access_code}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(accessCode.access_code)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>{getTypeBadge(accessCode.is_group, accessCode.people_count)}</TableCell>
                          {/* ✅ NUEVO: Mostrar datos de pago en la tabla */}
                          <TableCell className="font-mono text-sm">
                            {accessCode.payment_number || "Sin número"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {getShortAccountHolder(accessCode.account_holder)}
                          </TableCell>
                          <TableCell>{getStatusBadge(accessCode.status)}</TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {new Date(accessCode.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(accessCode)}
                                title="Editar número de personas"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDeleteDialog(accessCode)}
                                title="Eliminar código"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-8">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{(accessCodes || []).length}</p>
                  <p className="text-sm text-gray-600">Total códigos</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-8">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {(accessCodes?.filter((code) => code.status === "paid").length || 0)}
                  </p>
                  <p className="text-sm text-gray-600">Pagados</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-8">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {(accessCodes?.filter((code) => (code.status as string)  === "used").length || 0)}
                  </p>
                  <p className="text-sm text-gray-600">Usados</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Diálogo: Editar Número de Personas */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actualizar Número de Personas</DialogTitle>
            <DialogDescription>
              Modifica el número de personas para el código {selectedAccessCode?.access_code}
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(updatePeopleCount)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="people_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de personas</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="20" {...field} />
                    </FormControl>
                    <FormDescription>
                      {editForm.watch("people_count") === 1
                        ? "Individual"
                        : `Grupo de ${editForm.watch("people_count")} personas`}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Actualizar</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Confirmar Eliminación */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar el código "{selectedAccessCode?.access_code}"?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={deleteAccessCode}>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar Código
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}