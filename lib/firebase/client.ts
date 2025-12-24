// src/lib/firebase/client.ts
import {
  ref as dbRef,
  push,
  set,
  update,
  remove,
  get,
  query,
  orderByChild,
  equalTo,
} from "firebase/database"
import { database } from "./config"

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
  gallery?: string[]
}
interface AccessCode {
  id: string;
  document_id: string;
  status: "paid" | "used" | "pending";
  is_group: boolean;
  people_count: number;
  assigned_to_group?: boolean;
}

interface Registration {
  id: string;
  document_id: string;
  full_name: string;
  phone: string;
  rh: string;
  route_id_day1?: string;
  route_id_day2?: string;
  access_code: string;
  group_id?: string;
  payment_status: "paid" | "pending";
  registration_type: "group_leader" | "group_member" | "individual";
  created_at: string;
  updated_at?: string;
  document_type: string;
  group_name?: string;
  leader_full_name?: string;
}


class FirebaseClient {
  // Rutas
  async getRoutes() {
    try {
      const routesRef = dbRef(database, "routes")
      const snapshot = await get(routesRef)
      if (snapshot.exists()) {
        const routes: Route[] = []
        snapshot.forEach((childSnapshot) => {
          const routeData = childSnapshot.val()
          routes.push({
            id: childSnapshot.key,
            ...routeData,
            available_spots_by_day:
              routeData.available_spots_by_day || [
                { day: 1, spots: 0 },
                { day: 2, spots: 0 },
              ],
          })
        })
        return routes
      }
      return []
    } catch (error) {
      console.error("Error al obtener rutas:", error)
      throw error
    }
  }

  async getRouteById(id: string) {
    try {
      const routeRef = dbRef(database, `routes/${id}`)
      const snapshot = await get(routeRef)
      if (snapshot.exists()) {
        const routeData = snapshot.val()
        return {
          id: snapshot.key,
          ...routeData,
          available_spots_by_day:
            routeData.available_spots_by_day || [
              { day: 1, spots: 0 },
              { day: 2, spots: 0 },
            ],
        }
      }
      return null
    } catch (error) {
      console.error(`Error al obtener ruta ${id}:`, error)
      throw error
    }
  }

  async createRoute(routeData: any) {
    try {
      const routesRef = dbRef(database, "routes")
      const newRouteRef = push(routesRef)
      const formattedData = {
        ...routeData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await set(newRouteRef, formattedData)
      return { id: newRouteRef.key, ...formattedData }
    } catch (error) {
      console.error("Error al crear ruta:", error)
      throw error
    }
  }

  async updateRoute(id: string, routeData: any) {
    try {
      const routeRef = dbRef(database, `routes/${id}`)
      const formattedData = {
        ...routeData,
        updated_at: new Date().toISOString(),
      }
      await update(routeRef, formattedData)
      return { id, ...formattedData }
    } catch (error) {
      console.error(`Error al actualizar ruta ${id}:`, error)
      throw error
    }
  }

  async deleteRoute(id: string) {
    try {
      const routeRef = dbRef(database, `routes/${id}`)
      await remove(routeRef)
      return true
    } catch (error) {
      console.error(`Error al eliminar ruta ${id}:`, error)
      throw error
    }
  }

  // Cupos disponibles por ruta
  async getAvailableSpotsByRoute(routeId: string) {
    try {
      const registrationsRef = dbRef(database, "registrations")
      const routeQuery = query(
        registrationsRef,
        orderByChild("route_id"),
        equalTo(routeId)
      )
      const snapshot = await get(routeQuery)
      const registrationsByDay: Record<string, number> = {}
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const registration = childSnapshot.val()
          if (registration.payment_status === "paid") {
            const day = registration.day || 1
            registrationsByDay[day] = (registrationsByDay[day] || 0) + 1
          }
        })
      }
      return registrationsByDay
    } catch (error) {
      console.error(`Error al calcular cupos para ruta ${routeId}:`, error)
      return {}
    }
  }

  // Actualizar cupos de una ruta por día
  async updateSpots(routeId: string, quantity: number, day: number) {
    try {
      const routeRef = dbRef(database, `routes/${routeId}`)
      const snapshot = await get(routeRef)
      if (snapshot.exists()) {
        const routeData = snapshot.val()
        const spotsByDay: DaySpots[] = routeData.available_spots_by_day || [
          { day: 1, spots: 0 },
          { day: 2, spots: 0 },
        ]

        const updatedSpots = spotsByDay.map((item) =>
          item.day === day ? { ...item, spots: Math.max(0, item.spots - quantity) } : item
        )

        await update(routeRef, {
          available_spots_by_day: updatedSpots,
          updated_at: new Date().toISOString(),
        })

        return true
      }
      throw new Error("Ruta no encontrada")
    } catch (error) {
      console.error(`Error al actualizar cupos para ruta ${routeId}:`, error)
      throw error
    }
  }

  // traer grupos
  async getGroups() {
    try {
      const groupsRef = dbRef(database, "groups")
      const snapshot = await get(groupsRef)
      if (snapshot.exists()) {
        const groups: any[] = []
        snapshot.forEach((childSnapshot) => {
          groups.push({
            id: childSnapshot.key,
            ...childSnapshot.val(),
          })
        })
        return groups.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      }
      return []
    } catch (error) {
      console.error("Error al obtener grupos:", error)
      throw error
    }
  } 

  //crear grupo
  async createGroup(groupData: {
    group_name: string
    leader_document_id: string
    member_count: number
    // Si groupData pudiera contener un 'id' desde el origen, lo manejaríamos aquí
    // Si no, la interfaz está bien.
  }) {
    try {
      const groupsRef = dbRef(database, "groups")
      const newGroupRef = push(groupsRef) // Genera una nueva clave (ID) para el grupo
  
      // ✅ CORRECCIÓN: 'formattedData' ahora contiene solo los datos que se guardarán en Firebase
      // NO incluye 'id' aquí, porque el 'newGroupRef.key' es el ID de la entrada en la base de datos.
      const formattedData = {
        ...groupData, // Esparce las propiedades del objeto groupData de entrada
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
  
      // Guarda los datos en la nueva referencia generada por push()
      await set(newGroupRef, formattedData)
  
      // ✅ CORRECCIÓN: En el retorno, combinamos el ID generado por Firebase con los datos guardados.
      // El 'id: newGroupRef.key' va primero y luego se esparce 'formattedData'
      // (que no contiene un 'id' duplicado).
      return { id: newGroupRef.key, ...formattedData }
    } catch (error) {
      console.error("Error al crear grupo:", error)
      throw error
    }
  }

  // Códigos de acceso
  async getAccessCodes() {
    try {
      const accessCodesRef = dbRef(database, "access_codes")
      const snapshot = await get(accessCodesRef)
      if (snapshot.exists()) {
        const codes: any[] = []
        snapshot.forEach((childSnapshot) => {
          codes.push({
            id: childSnapshot.key,
            ...childSnapshot.val(),
          })
        })
        return codes.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      }
      return []
    } catch (error) {
      console.error("Error al obtener códigos de acceso:", error)
      throw error
    }
  }

  async getAccessCodeByDocument(documentId: string) {
    try {
      const accessCodesRef = dbRef(database, "access_codes")
      const docQuery = query(
        accessCodesRef,
        orderByChild("document_id"),
        equalTo(documentId)
      )
      const snapshot = await get(docQuery)
      if (snapshot.exists()) {
        let accessCode = null
        snapshot.forEach((childSnapshot) => {
          accessCode = {
            id: childSnapshot.key,
            ...childSnapshot.val(),
          }
        })
        return accessCode
      }
      return null
    } catch (error) {
      console.error(
        `Error al buscar código por documento ${documentId}:`,
        error
      )
      throw error
    }
  }

  async getAccessCodeByCode(code: string): Promise<AccessCode | null> {
    try {
      const accessCodesRef = dbRef(database, "access_codes")
      const codeQuery = query(
        accessCodesRef,
        orderByChild("access_code"),
        equalTo(code)
      )
      const snapshot = await get(codeQuery)
      if (snapshot.exists()) {
        let accessCode = null
        snapshot.forEach((childSnapshot) => {
          accessCode = {
            id: childSnapshot.key,
            ...childSnapshot.val(),
          }
        })
        return accessCode
      }
      return null
    } catch (error) {
      console.error(`Error al buscar código "${code}":`, error)
      throw error
    }
  }

  async createAccessCode(accessCodeData: any) {
    try {
      const accessCodesRef = dbRef(database, "access_codes")
      const newAccessCodeRef = push(accessCodesRef)
      const codePrefix = accessCodeData.people_count > 1 ? "GRP" : "IND"
      const codeNumber = Date.now().toString().slice(-6)
      const accessCode = `${codePrefix}-${codeNumber}`
      const formattedData = {
        document_id: accessCodeData.document_id,
        people_count: accessCodeData.people_count,
        payment_number: accessCodeData.payment_number,
        account_holder: accessCodeData.account_holder,
        access_code: accessCode,
        is_group: accessCodeData.people_count > 1,
        payment_images: accessCodeData.payment_images || [],
        status: "paid",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await set(newAccessCodeRef, formattedData)
      return { id: newAccessCodeRef.key, ...formattedData }
    } catch (error) {
      console.error("Error al crear código de acceso:", error)
      throw error
    }
  }

  async updateAccessCode(id: string, accessCodeData: any) {
    try {
      const accessCodeRef = dbRef(database, `access_codes/${id}`)
      const formattedData = {
        ...accessCodeData,
        updated_at: new Date().toISOString(),
      }
      await update(accessCodeRef, formattedData)
      return { id, ...formattedData }
    } catch (error) {
      console.error(`Error al actualizar código de acceso ${id}:`, error)
      throw error
    }
  }

  async deleteAccessCode(id: string) {
    try {
      const accessCodeRef = dbRef(database, `access_codes/${id}`)
      await remove(accessCodeRef)
      return true
    } catch (error) {
      console.error(`Error al eliminar código de acceso ${id}:`, error)
      throw error
    }
  }

  // Inscripciones
  async getRegistrations() {
    try {
      const registrationsRef = dbRef(database, "registrations")
      const snapshot = await get(registrationsRef)
      if (snapshot.exists()) {
        const registrations: any[] = []
        snapshot.forEach((childSnapshot) => {
          registrations.push({
            id: childSnapshot.key,
            ...childSnapshot.val(),
          })
        })
        return registrations
      }
      return []
    } catch (error) {
      console.error("Error al obtener inscripciones:", error)
      throw error
    }
  }

  async getRegistrationByDocument(documentId: string): Promise<Registration | null> {
    try {
      const registrationsRef = dbRef(database, "registrations")
      const docQuery = query(
        registrationsRef,
        orderByChild("document_id"),
        equalTo(documentId)
      )
      const snapshot = await get(docQuery)
      if (snapshot.exists()) {
        let registration = null
        snapshot.forEach((childSnapshot) => {
          registration = {
            id: childSnapshot.key,
            ...childSnapshot.val(),
          }
        })
        return registration
      }
      return null
    } catch (error) {
      console.error(
        `Error al obtener inscripción por documento ${documentId}:`,
        error
      )
      throw error
    }
  }

  async createRegistration(registrationData: any) {
    try {
      const registrationsRef = dbRef(database, "registrations")
      const newRegistrationRef = push(registrationsRef)
      const formattedData = {
        ...registrationData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await set(newRegistrationRef, formattedData)
      return { id: newRegistrationRef.key, ...formattedData }
    } catch (error) {
      console.error("Error al crear inscripción:", error)
      throw error
    }
  }

  async updateRegistration(document_id: string, registrationData: any) {
    try {
      const registrationsReff = dbRef(database, "registrations")
      const q = query(registrationsReff, orderByChild("document_id"), equalTo(document_id))
      const snapshot = await get(q)
  
      if (!snapshot.exists()) {
        throw new Error(`No se encontró una inscripción con document_id ${document_id}`)
      }
  
      // 2. Encontrar el primer nodo que coincida
      let foundKey = null
      let foundData = null
  
      snapshot.forEach((childSnapshot) => {
        foundKey = childSnapshot.key
        foundData = childSnapshot.val()
      })
  
      if (!foundKey || !foundData) {
        throw new Error("No se pudo encontrar el registro")
      }
      const registrationRef = dbRef(database, `registrations/${foundKey}`)
      const formattedData = {
        ...registrationData,
        updated_at: new Date().toISOString(),
      }
      await update(registrationRef, formattedData)
      return { foundKey, ...formattedData }
    } catch (error) {
      console.error(`Error al actualizar inscripción:`, error)
      throw error
    }
  }

  async createPayment(paymentData: any) {
    try {
      const paymentsRef = dbRef(database, "payments")
      const newPaymentRef = push(paymentsRef)
      const formattedData = {
        ...paymentData,
        created_at: new Date().toISOString(),
      }
      await set(newPaymentRef, formattedData)
      return { id: newPaymentRef.key, ...formattedData }
    } catch (error) {
      console.error("Error al crear pago:", error)
      throw error
    }
  }

  // Configuración
  async getSettings() {
    try {
      const settingsRef = dbRef(database, "settings")
      const snapshot = await get(settingsRef)
      if (snapshot.exists()) {
        return snapshot.val()
      }
      return {
        registration_price: 50000,
        bank_name: "Banco Nacional",
        account_type: "Ahorros",
        account_number: "123-456789-0",
        account_holder: "Evento Caminera S.A.S.",
        nit: "900.123.4567",
        whatsapp_number: "+57 300 123 4567",
        payment_instructions:
          "Envía una foto del comprobante de pago al WhatsApp junto con tu número de cédula.",
      }
    } catch (error) {
      console.error("Error al obtener configuración:", error)
      throw error
    }
  }

  async updateSettings(settingsData: any) {
    try {
      const settingsRef = dbRef(database, "settings")
      const formattedData = {
        ...settingsData,
        updated_at: new Date().toISOString(),
      }
      await set(settingsRef, formattedData)
      return formattedData
    } catch (error) {
      console.error("Error al actualizar configuración:", error)
      throw error
    }
  }

  // Programación del evento
  async getEventSchedule() {
    try {
      const scheduleRef = dbRef(database, "event_schedule")
      const snapshot = await get(scheduleRef)
      if (snapshot.exists()) {
        const schedule: any[] = []
        snapshot.forEach((childSnapshot) => {
          schedule.push({
            id: childSnapshot.key,
            ...childSnapshot.val(),
          })
        })
        return schedule.sort((a, b) => a.order - b.order)
      }
      return []
    } catch (error) {
      console.error("Error al obtener programación:", error)
      throw error
    }
  }

  async createScheduleItem(scheduleData: any) {
    try {
      const scheduleRef = dbRef(database, "event_schedule")
      const newScheduleRef = push(scheduleRef)
      const formattedData = {
        ...scheduleData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await set(newScheduleRef, formattedData)
      return { id: newScheduleRef.key, ...formattedData }
    } catch (error) {
      console.error("Error al crear item de programación:", error)
      throw error
    }
  }

  async updateScheduleItem(id: string, scheduleData: any) {
    try {
      const scheduleRef = dbRef(database, `event_schedule/${id}`)
      const formattedData = {
        ...scheduleData,
        updated_at: new Date().toISOString(),
      }
      await update(scheduleRef, formattedData)
      return { id, ...formattedData }
    } catch (error) {
      console.error(`Error al actualizar item de programación ${id}:`, error)
      throw error
    }
  }

  async deleteScheduleItem(id: string) {
    try {
      const scheduleRef = dbRef(database, `event_schedule/${id}`)
      await remove(scheduleRef)
      return true
    } catch (error) {
      console.error(`Error al eliminar item de programación ${id}:`, error)
      throw error
    }
  }

  // src/lib/firebase/client.ts

async getGroupById(id: string) {
  const snapshot = await get(dbRef(database, `groups/${id}`))
  if (snapshot.exists()) {
    return { id, ...snapshot.val() }
  }
  return null
}

async getRegistrationsByGroupId(groupId: string) {
  try {
    const snapshot = await get(
      query(
        dbRef(database, "registrations"),
        orderByChild("group_id"),
        equalTo(groupId)
      )
    )

    const result: any[] = []

    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        result.push({
          id: childSnapshot.key,
          ...childSnapshot.val(),
        })
      })
    }

    return result
  } catch (error) {
    console.error(`Error al obtener caminantes del grupo ${groupId}:`, error)
    return []
  }
}

async createRegistrationGroup(data: any) {
  const ref = dbRef(database, `registrations/${data.document_id}`)
  await set(ref, data)
  return { id: data.document_id, ...data }
}

async updateRegistrationGroup(documentId: string, data: any) {
  const ref = dbRef(database, `registrations/${documentId}`)
  await update(ref, data)
  return data
}

async deleteRegistration(documentId: string) {
  const ref = dbRef(database, `registrations/${documentId}`)
  await remove(ref)
}
// firebaseClient.ts

async getGroupByLeaderDocument(documentId: string) {
  const snapshot = await get(query(dbRef(database, "groups"), orderByChild("leader_document_id"), equalTo(documentId)))
  const result: any[] = []
  snapshot.forEach(childSnapshot => {
    result.push({ id: childSnapshot.key, ...childSnapshot.val() })
  })
  return result[0] || null
}
  async updateGroup(groupId: string, groupData: Partial<{
    group_name: string
    leader_document_id: string
    member_count: number
    }>) {
      const groupRef = dbRef(database, `groups/${groupId}`)
      const formattedData = {
        ...groupData,
        updated_at: new Date().toISOString(),
      }
      await update(groupRef, formattedData)
      return formattedData
  }
  
  

}

export const firebaseClient = new FirebaseClient()