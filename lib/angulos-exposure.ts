// Banco fijo de 25 ángulos de contenido de EXPOSURE (doc "Avatar Pibardo - BIZOP", sección "25 ÁNGULOS DE CONTENIDO").
// Regla de la casa: no se inventan ángulos nuevos; todo contenido se mapea contra este inventario.
export type AnguloExposure = { id: number; titulo: string; dolor: string }

export const ANGULOS_EXPOSURE: AnguloExposure[] = [
  { id: 1, titulo: "El techo del rol operativo: ser el mejor editando, cerrando o seteando no te saca de los 1.500", dolor: "techo operativo" },
  { id: 2, titulo: "Sos el mejor empleado del negocio de otro y el peor jefe de vos mismo", dolor: "techo operativo" },
  { id: 3, titulo: "Llevás dos años \"metido en lo digital\" y todavía no tenés un negocio. ¿Por qué?", dolor: "falta de vehículo" },
  { id: 4, titulo: "Tenés las ganas, el tiempo y la habilidad. Lo único que te falta es el vehículo", dolor: "falta de vehículo" },
  { id: 5, titulo: "\"Me falta información\" es la mentira que te contás para no arrancar", dolor: "procrastinación" },
  { id: 6, titulo: "Consumiste 2 años de contenido de negocios y seguís en cero. El consumo no es acción", dolor: "procrastinación" },
  { id: 7, titulo: "Tocaste un pico una vez y bajaste: el pico sin sistema es peor que nunca subir", dolor: "falta de sistema" },
  { id: 8, titulo: "Vender tu habilidad barata vs. usarla para operar lo tuyo: la diferencia de 300 a 3.000", dolor: "oferta pobre" },
  { id: 9, titulo: "El cliente que regatea es culpa de tu oferta, no del cliente", dolor: "oferta pobre" },
  { id: 10, titulo: "La trampa de laburar en el negocio de otro: cobrás lo que él decide", dolor: "techo operativo" },
  { id: 11, titulo: "Probaste dropshipping, afiliados, trading y no pegaste. No era vos, era el vehículo", dolor: "falta de vehículo" },
  { id: 12, titulo: "Prospección en frío: cinco \"no\" por día te están quemando", dolor: "adquisición sin control" },
  { id: 13, titulo: "El miedo al high ticket no es por la plata, es porque te sentís un impostor", dolor: "impostor" },
  { id: 14, titulo: "10K te parece imposible solo porque nadie de tu entorno lo gana", dolor: "autoestima" },
  { id: 15, titulo: "El pueblo, el bullying y por qué todavía no te mostrás", dolor: "marca personal" },
  { id: 16, titulo: "\"Quiero disfrutar la vida\" vs. \"quiero comerme el mundo\": el subibaja que te traba", dolor: "identidad" },
  { id: 17, titulo: "No querés un negocio. Querés demostrarte que podés", dolor: "identidad" },
  { id: 18, titulo: "El verdadero lujo no es el Lambo: es reponer un celu robado sin que duela", dolor: "identidad" },
  { id: 19, titulo: "Ves 20 caminos y no sabés cuál tomar. El problema no es falta de opciones", dolor: "parálisis" },
  { id: 20, titulo: "La diferencia entre el que arranca y el que \"piensa el negocio\" dos años", dolor: "procrastinación" },
  { id: 21, titulo: "Estudiás algo que ya sabés que no vas a ejercer. ¿Por qué seguís ahí?", dolor: "falta de vehículo" },
  { id: 22, titulo: "El costo de oportunidad de tus últimos 5 meses, en dólares", dolor: "procrastinación" },
  { id: 23, titulo: "Tenés habilidades reales y las estás regalando como servicio barato", dolor: "oferta pobre" },
  { id: 24, titulo: "Los referentes te inspiran pero no te sirven de espejo (y quién sí)", dolor: "autoestima" },
  { id: 25, titulo: "La estafa que te hicieron y por qué ahora no confiás en nadie (y cómo elegir bien)", dolor: "confianza" },
]

export const ANGULOS_EXPOSURE_TITULOS = ANGULOS_EXPOSURE.map((a) => a.titulo)
