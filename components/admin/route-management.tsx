"use client"

import { useState, useEffect } from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useFieldArray } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, Plus, MapPin, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { firebaseClient } from "@/lib/firebase/client"

type DaySpots = {
  day: number
  spots: number
  enabled: boolean
}

interface Route {
  id: string;
  name: string;
  elevation: string;
  description: string;
  available_spots_by_day: DaySpots[];
  duration: string;
  difficulty: "Fácil" | "Moderada" | "Difícil";
  image_url: string;
  distance: string;
  meeting_point: string;
}

const routeFormSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
  difficulty: z.enum(["Fácil", "Moderada", "Difícil"], {
    errorMap: (issue, ctx) => {
      if (issue.code === z.ZodIssueCode.invalid_enum_value) {
        return { message: "La dificultad debe ser 'Fácil', 'Moderada' o 'Difícil'" };
      }
      return { message: ctx.defaultError };
    },
  }),
  image_url: z.string().url("Debe ser una URL válida").or(z.string().length(0)),
  available_spots_by_day: z
    .array(
      z.object({
        day: z.number().min(1, "El día debe ser mayor a 0"),
        spots: z.number().min(0, "Los cupos no pueden ser negativos"),
        enabled: z.boolean().default(true),
      }),
    )
    .max(3, "Máximo 3 días permitidos")
    .refine(
      (days) => days.some(day => day.enabled),
      "Debe haber al menos un día habilitado"
    ),
  duration: z.string().min(1, "Ingresa la duración"),
  distance: z.string().min(1, "Ingresa la distancia"),
  elevation: z.string().min(1, "Ingresa la elevación"),
  meeting_point: z.string().min(1, "Ingresa el punto de encuentro"),
})

export default function RouteManagement() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null)

  const form = useForm<z.infer<typeof routeFormSchema>>({
    resolver: zodResolver(routeFormSchema),
    defaultValues: {
      name: "",
      description: "",
      difficulty: "Fácil",
      image_url: "",
      available_spots_by_day: [
        { day: 1, spots: 0, enabled: true },
        { day: 2, spots: 0, enabled: true },
        { day: 3, spots: 0, enabled: false },
      ],
      duration: "",
      distance: "",
      elevation: "",
      meeting_point: "",
    },
  })

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "available_spots_by_day",
  })

  useEffect(() => {
    fetchRoutes()
  }, [])

  useEffect(() => {
    if (currentRoute && isEditDialogOpen) {
      const daysData = currentRoute.available_spots_by_day || [];
      
      // Asegurarnos de que siempre tengamos exactamente 3 días en el formulario
      const defaultDays = [
        { day: 1, spots: 0, enabled: false },
        { day: 2, spots: 0, enabled: false },
        { day: 3, spots: 0, enabled: false }
      ];
      
      // Actualizar los días con los datos existentes
      daysData.forEach(day => {
        if (day.day >= 1 && day.day <= 3) {
          defaultDays[day.day - 1] = {
            day: day.day,
            spots: day.spots,
            enabled: day.enabled !== false
          };
        }
      });

      form.reset({
        name: currentRoute.name,
        description: currentRoute.description,
        difficulty: currentRoute.difficulty,
        image_url: currentRoute.image_url,
        available_spots_by_day: defaultDays,
        duration: currentRoute.duration,
        distance: currentRoute.distance,
        elevation: currentRoute.elevation,
        meeting_point: currentRoute.meeting_point,
      })
    }
  }, [currentRoute, isEditDialogOpen, form])

  const fetchRoutes = async () => {
    setLoading(true)
    try {
      const data = await firebaseClient.getRoutes()
      setRoutes(data)
    } catch (error) {
      console.error("Error fetching routes:", error)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: z.infer<typeof routeFormSchema>) => {
    try {
      // Filtrar solo los días habilitados para guardar
      const dataToSave = {
        ...data,
        available_spots_by_day: data.available_spots_by_day.filter(day => day.enabled)
      };

      if (isEditDialogOpen && currentRoute) {
        await firebaseClient.updateRoute(currentRoute.id, dataToSave)
        setRoutes(routes.map((route) => (route.id === currentRoute.id ? { ...route, ...dataToSave } : route)))

        toast.success("Ruta actualizada", {
          description: "La ruta ha sido actualizada exitosamente.",
        })
      } else {
        const newRoute = await firebaseClient.createRoute(dataToSave)
        setRoutes([...routes, newRoute])

        toast.success("Ruta agregada", {
          description: "La nueva ruta ha sido agregada exitosamente.",
        })
      }

      form.reset({
        name: "",
        description: "",
        difficulty: "Fácil",
        image_url: "",
        available_spots_by_day: [
          { day: 1, spots: 0, enabled: true },
          { day: 2, spots: 0, enabled: true },
          { day: 3, spots: 0, enabled: false },
        ],
        duration: "",
        distance: "",
        elevation: "",
        meeting_point: "",
      })
      setIsAddDialogOpen(false)
      setIsEditDialogOpen(false)
    } catch (error) {
      console.error("Error saving route:", error)
      toast.error("Error", {
        description: "Hubo un problema al guardar la ruta. Por favor intenta nuevamente.",
      })
    }
  }

  const handleDelete = async () => {
    if (!currentRoute) return

    try {
      await firebaseClient.deleteRoute(currentRoute.id)
      setRoutes(routes.filter((route) => route.id !== currentRoute.id))

      toast.success("Ruta eliminada", {
        description: "La ruta ha sido eliminada exitosamente.",
      })

      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error("Error deleting route:", error)
      toast.error("Error", {
        description: "Hubo un problema al eliminar la ruta. Por favor intenta nuevamente.",
      })
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Fácil":
        return "bg-green-500"
      case "Moderada":
        return "bg-yellow-500"
      case "Difícil":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const toggleDayEnabled = (index: number) => {
    const currentValue = fields[index]?.enabled || false;
    update(index, {
      ...fields[index],
      enabled: !currentValue,
      spots: !currentValue ? fields[index]?.spots || 0 : 0 // Reset spots when disabling
    });
  }

  const addNewDay = () => {
    // Buscar el primer día deshabilitado para habilitarlo
    const disabledDayIndex = fields.findIndex(day => !day.enabled);
    if (disabledDayIndex !== -1) {
      update(disabledDayIndex, {
        ...fields[disabledDayIndex],
        enabled: true,
        spots: 0
      });
    } else {
      toast.info("Límite alcanzado", {
        description: "Ya has configurado el máximo de 3 días.",
      });
    }
  }

  const getSpotsByDay = (route: Route, day: number) => {
    if (!route.available_spots_by_day) return { spots: "-", enabled: false };
    const daySpot = route.available_spots_by_day.find((spot) => spot.day === day);
    return { 
      spots: daySpot ? daySpot.spots.toString() : "-",
      enabled: daySpot?.enabled !== false
    };
  }

  // Siempre mostrar 3 columnas para los días
  const maxDays = 3;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Gestión de Rutas</h1>
        <Button
          onClick={() => {
            form.reset({
              name: "",
              description: "",
              difficulty: "Fácil",
              image_url: "",
              available_spots_by_day: [
                { day: 1, spots: 0, enabled: true },
                { day: 2, spots: 0, enabled: true },
                { day: 3, spots: 0, enabled: false },
              ],
              duration: "",
              distance: "",
              elevation: "",
              meeting_point: "",
            })
            setIsAddDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Agregar Ruta
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Nombre</TableHead>
                  <TableHead>Dificultad</TableHead>
                  {Array.from({ length: maxDays }, (_, i) => (
                    <TableHead key={i + 1} className="text-center">Día {i + 1}</TableHead>
                  ))}
                  <TableHead className="min-w-[150px]">Punto de encuentro</TableHead>
                  <TableHead className="text-left">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4 + maxDays} className="text-center py-8">
                      Cargando rutas...
                    </TableCell>
                  </TableRow>
                ) : routes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4 + maxDays} className="text-center py-8">
                      No hay rutas disponibles. Agrega una nueva ruta.
                    </TableCell>
                  </TableRow>
                ) : (
                  routes.map((route) => (
                    <TableRow key={route.id}>
                      <TableCell className="font-medium">{route.name}</TableCell>
                      <TableCell>
                        <Badge className={`${getDifficultyColor(route.difficulty)} text-white`}>
                          {route.difficulty}
                        </Badge>
                      </TableCell>
                      {Array.from({ length: maxDays }, (_, i) => {
                        const dayInfo = getSpotsByDay(route, i + 1);
                        return (
                          <TableCell key={i + 1} className="text-center">
                            {dayInfo.enabled ? (
                              <div>
                                <div className="font-medium">{dayInfo.spots} cupos</div>
                                <Badge variant="outline" className="text-xs mt-1 border-green-200 bg-green-50 text-green-700">
                                  Habilitado
                                </Badge>
                              </div>
                            ) : (
                              <div className="text-gray-400">
                                <div className="line-through">-</div>
                                <Badge variant="outline" className="text-xs mt-1 bg-gray-50 text-gray-500">
                                  No disponible
                                </Badge>
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1 text-gray-500 flex-shrink-0" />
                        <span className="truncate">{route.meeting_point}</span>
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setCurrentRoute(route)
                              setIsEditDialogOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setCurrentRoute(route)
                              setIsDeleteDialogOpen(true)
                            }}
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

      {/* Add/Edit Route Dialog */}
      <Dialog
        open={isAddDialogOpen || isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false)
            setIsEditDialogOpen(false)
          }
        }}
      >
        <DialogContent className="max-w-8xl min-w-[60vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditDialogOpen ? "Editar Ruta" : "Agregar Nueva Ruta"}</DialogTitle>
            <DialogDescription>
              {isEditDialogOpen
                ? "Modifica los detalles de la ruta existente."
                : "Completa el formulario para agregar una nueva ruta."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la ruta</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Sendero del Bosque" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="difficulty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dificultad</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una dificultad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Fácil">Fácil</SelectItem>
                          <SelectItem value="Moderada">Moderada</SelectItem>
                          <SelectItem value="Difícil">Difícil</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe la ruta, sus características y atractivos..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="image_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL de la imagen</FormLabel>
                    <FormControl>
                      <Input placeholder="https://ejemplo.com/imagen.jpg" {...field} />
                    </FormControl>
                    <FormDescription>URL de la imagen principal de la ruta</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cupos por día */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <FormLabel className="text-base font-medium">Configuración de días</FormLabel>
                    <FormDescription className="mt-0">
                      Máximo 3 días. Puedes habilitar/deshabilitar días según sea necesario.
                    </FormDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addNewDay}>
                    <Plus className="h-4 w-4 mr-1" />
                    Habilitar día
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="space-y-2 border p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-base font-medium">
                          Día {field.day}
                        </span>
                        <Button
                          type="button"
                          variant={field.enabled ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleDayEnabled(index)}
                          className={field.enabled ? "bg-green-600 hover:bg-green-700" : ""}
                        >
                          {field.enabled ? (
                            <>
                              <Eye className="h-3 w-3 mr-1" /> Habilitado
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3 mr-1" /> Deshabilitado
                            </>
                          )}
                        </Button>
                      </div>
                      
                      {field.enabled && (
                        <FormField
                          control={form.control}
                          name={`available_spots_by_day.${index}.spots`}
                          render={({ field: spotsField }) => (
                            <FormItem>
                              <FormLabel>Cupos disponibles</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  {...spotsField}
                                  onChange={(e) => spotsField.onChange(Number.parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duración</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. 3 horas" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="distance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Distancia</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. 5 km" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="elevation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Elevación</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. 150 m" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="meeting_point"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Punto de encuentro</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Parque Central, entrada principal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="submit">{isEditDialogOpen ? "Guardar cambios" : "Agregar ruta"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar la ruta "{currentRoute?.name}"? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}