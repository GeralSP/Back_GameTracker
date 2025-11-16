const express = require('express');
const session = require('express-session')
const mongoose = require('mongoose')
const cors = require('cors')
const bcrypt = require('bcryptjs');




// ========================================================================
// ============================== Middleware ==============================
// ========================================================================
const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors());
app.use(session({
    secret:'1234',
    resave:false,
    saveUninitialized:true,
    cookie:{secure:false}
}))




// ====================================================================================
// ============================== Conexion base de datos ==============================
// ====================================================================================
const conect = mongoose.connection
mongoose.connect('mongodb+srv://jacobogarcesoquendo:aFJzVMGN3o7fA38A@cluster0.mqwbn.mongodb.net/GeraldineSierra')
conect.once('open', async () => {
    console.log("Base de datos Conectada")

    // --- Insertar tipos de juegos automáticamente si no existen ---
    const count = await TipoJuego.countDocuments();
    if (count === 0) {
        const tipos = [
            { nombre_tipo: "Acción" },
            { nombre_tipo: "Aventura" },
            { nombre_tipo: "Acción-Aventura" },
            { nombre_tipo: "Shooter (Disparos)" },
            { nombre_tipo: "RPG (Rol)" },
            { nombre_tipo: "MMORPG" },
            { nombre_tipo: "Estrategia" },
            { nombre_tipo: "Estrategia en tiempo real (RTS)" },
            { nombre_tipo: "Simulación" },
            { nombre_tipo: "Deportes" },
            { nombre_tipo: "Carreras" },
            { nombre_tipo: "Plataformas" },
            { nombre_tipo: "Puzle (Rompecabezas)" },
            { nombre_tipo: "Supervivencia" },
            { nombre_tipo: "Horror / Terror" },
            { nombre_tipo: "Sandbox / Mundo abierto" },
            { nombre_tipo: "Lucha (Fighting)" },
            { nombre_tipo: "Battle Royale" },
            { nombre_tipo: "Musical / Ritmo" },
            { nombre_tipo: "Educativo" },
            { nombre_tipo: "Casual" },
            { nombre_tipo: "Metroidvania" },
            { nombre_tipo: "Rogue-like / Rogue-lite" },
            { nombre_tipo: "Indie" },
            { nombre_tipo: "VR (Realidad Virtual)" },
            { nombre_tipo: "Otro" }
        ];

        await TipoJuego.insertMany(tipos);
        console.log(`${tipos.length} tipos de juegos agregados automáticamente`);
    } else {
        console.log(`Ya existen ${count} tipos de juegos, no se insertaron duplicados`);
    }
})
conect.on('error', (error) => {
    console.log("Error en la conexion: " + error)
})


// --- Esctructura de las colecciones ---
const juegoSchema = new mongoose.Schema({
    imagen_url: {type: String, required: true},
    nombre: {type: String, required: true},
    promedio_puntuacion: {type: Number, default: 0},
    horas_jugadas: {type: Number, default: 0}
})

const tipo_juegoSchema = new mongoose.Schema({
    nombre_tipo: {type: String, required: true}
})

const usuarioShema = new mongoose.Schema({
    nombre_usuario: { type: String, required: true, unique: true },
    contrasena: { type: String, required: true }
})

const resenaSchema = new mongoose.Schema({
    descripcion: {type: String, required: true},
    id_juego: {type: mongoose.Schema.Types.ObjectId, ref: "juego"},
    id_usuario: {type: mongoose.Schema.Types.ObjectId, ref: "usuario"},
    createdAt: {type: Date, default: Date.now}
})


// "tablas intermedias"
const juego_tipo_juegoSchema = new mongoose.Schema({
id_juego: {type: mongoose.Schema.Types.ObjectId, ref: "juego"},
id_tipo_juego: {type: mongoose.Schema.Types.ObjectId, ref: "tipo_juego"}
})

const juego_usuarioSchema = new mongoose.Schema({
id_juego: {type: mongoose.Schema.Types.ObjectId, ref: "juego"},
id_usuario: {type: mongoose.Schema.Types.ObjectId, ref: "usuario"},
estado: {type: String, default: 'No jugado'},
puntuacion: {type: Number, default: 0},
})


// --- Modelos ---
const Juego = mongoose.model('juego', juegoSchema);
const TipoJuego = mongoose.model('tipo_juego', tipo_juegoSchema);
const Usuario = mongoose.model('usuario', usuarioShema);
const Resena = mongoose.model('resena', resenaSchema);
const JuegoTipoJuego = mongoose.model('juego_tipo_juego', juego_tipo_juegoSchema);





// ===================================================================
// ============================== Rutas ==============================
// ===================================================================
app.get('/', (req, res) => {
    res.send("<h1>Hola desde el backend</h1>")
})

// ========================== Usuario ==========================
// --- Registrar Usuario ---
app.post('/registrar_usuario', async (req, res) => {
    try{
        const {nombre_usuario, contrasena} = req.body

        const buscar_usuario = await Usuario.findOne({ nombre_usuario })

        if(buscar_usuario){
            return res.status(409).json({
                success: false,
                message: 'Este usuario ya existe'
            })
        }

        // Encriptar contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(contrasena, salt);

        const nuevo_usuario = new Usuario({
            nombre_usuario, contrasena: hashedPass
        })

        await nuevo_usuario.save();

        return res.status(201).json({
            success: true,
            message: 'Usuario registrado con exito'
        })
    }
    catch(error) {
        console.error('Error: ' + error)
        return res.status(500).json({
            success: false,
            message: "No se pudo registrar el usuario"
        })
    }
})


// --- Iniciar Sesion ---

app.post('/iniciar_sesion', async (req, res) => {
    try {
        const { nombre_usuario, contrasena } = req.body;

        const buscar_usuario = await Usuario.findOne({ nombre_usuario });

        if (!buscar_usuario) {
            return res.status(409).json({
                success: false,
                message: 'Credenciales incorrectas'
            });
        }

        // Verificar contraseña
        const validarPassword = await bcrypt.compare(contrasena, buscar_usuario.contrasena);

        if (!validarPassword) {
            return res.status(409).json({
                success: false,
                message: 'Credenciales incorrectas'
            });
        }

        // Guardar datos en sesión
        req.session.usuario = {
            id: buscar_usuario._id,
            nombre_usuario: buscar_usuario.nombre_usuario
        };

        return res.status(200).json({
            success: true,
            message: 'Inicio de sesión exitoso'
        });

    } catch (error) {
        console.error('Error: ' + error);
        return res.status(500).json({
            success: false,
            message: "Error en el servidor"
        });
    }
});

// ========================== Juegos ==========================

// --- agregar un juego ---
app.post('/agregar_juego', async (req, res) => {
    try{
        const {imagen_url, nombre, estado, puntuacion, horas_jugadas, id_tipo_juego} = req.body

        const buscar_juego = await Juego.findOne({nombre})

        if(buscar_juego){
            return res.status(409).json({
                success: false,
                message: 'El juego ya existe'
            })
        }

        const nuevo_juego = new Juego({
            imagen_url, nombre, estado, puntuacion, horas_jugadas
        })

        const juego_guardado = await nuevo_juego.save();

        for (let i = 0; i < id_tipo_juego.length; i++) {
            const agregar_tipo_juego = new JuegoTipoJuego({
                id_juego: juego_guardado._id,
                id_tipo_juego: id_tipo_juego[i] 
            });
            await agregar_tipo_juego.save();
        }

        return res.status(201).json({
            success: true,
            message: 'Juego agregado con exito'
        })
    }
    catch(error) {
        console.error('Error: ' + error)
        return res.status(500).json({
            success: false,
            message: "No se pudo agregar juego"
        })
    }
})

// --- obtener un juego por Id ---
app.post('/obtener_juego_id', async (req, res) => {
    try {
        const { id_juego } = req.body

        const buscar_juego = await Juego.findById(id_juego)
        if (!buscar_juego) {
            return res.status(404).json({
                success: false,
                message: 'Ese juego no existe'
            })
        }

        const buscar_tipo_juego = await JuegoTipoJuego.find({ id_juego }).populate("id_tipo_juego", "nombre_tipo")
        const buscar_resenas = await Resena.find({ id_juego }).sort({createdAt: -1})

        return res.status(200).json({
            success: true,
            data: {
                juego: buscar_juego,
                tipos: buscar_tipo_juego,
                cantidad_resenas: buscar_resenas.length,
                resenas: buscar_resenas
            }
        })
    } catch (error) {
        console.error('Error: ' + error)
        return res.status(500).json({
            success: false,
            message: "No se pudo obtener el juego"
        })
    }
})


// --- obtener todos los juegos ---
app.get('/obtener_juegos', async (req, res) => {
    try{
        const buscar_juegos = await Juego.find()

        if(!buscar_juegos){
            return res.status(404).json({
                success: false,
                message: 'No se encontraron los juegos'
            })
        }

        // Para cada juego, obtenemos tipos y reseñas
        const juegos_detalles = await Promise.all(
            buscar_juegos.map(async (juego) => {
                const tipos = await JuegoTipoJuego.find({ id_juego: juego._id }).populate("id_tipo_juego", "nombre_tipo")

                const resenas = await Resena.find({ id_juego: juego._id }).sort({createdAt: -1})

                return {
                    juego,
                    tipos,
                    cantidad_resenas: resenas.length,
                    resenas
                }
            })
        );

        return res.status(200).json({
            success: true,
            count: juegos_detalles.length,
            data: juegos_detalles
        });
    }
    catch(error){
        console.error('Error: ' + error)
        return res.status(500).json({
            success: false,
            message: 'No se pudo obtener todos los juegos'
        })
    }
})

// --- Editar Juego ---
app.put('/editar_juego', async (req, res) => {
    try {
        const { id_juego, imagen_url, nombre, estado, puntuacion, horas_jugadas, id_tipo_juego } = req.body

        const buscar_juego = await Juego.findOne({
            nombre: nombre,
            _id: { $ne: new mongoose.Types.ObjectId(id_juego) } // excluir el juego que se esta editando
        })

        if (buscar_juego) {
            return res.status(409).json({
                success: false,
                message: 'El juego ya existe'
            })
        }

        // Actualizar datos del juego
        const editar_juego = await Juego.findByIdAndUpdate(
            id_juego,
            { imagen_url, nombre, estado, puntuacion, horas_jugadas },
            { new: true }
        )

        // Eliminar tipos antiguos
        await JuegoTipoJuego.deleteMany({ id_juego: new mongoose.Types.ObjectId(id_juego) })

        // Agregar los tipos nuevos
        for (let i = 0; i < id_tipo_juego.length; i++) {
            const agregar_tipo_juego = new JuegoTipoJuego({
                id_juego: editar_juego._id,
                id_tipo_juego: id_tipo_juego[i]
            })
            await agregar_tipo_juego.save()
        }

        return res.status(200).json({
            success: true,
            message: 'Juego editado con exito'
        })
    } catch (error) {
        console.error('Error: ' + error)
        return res.status(500).json({
            success: false,
            message: 'No se pudo editar el juego'
        })
    }
})

// --- Eliminar Juego ---
app.post('/eliminar_juego', async (req, res) => {
    try{
        const {id_juego} = req.body

        const buscar_juego = await Juego.findById(id_juego)

        if(!buscar_juego){
            return res.status(404).json({
                success: false,
                message: 'No se encontro el juego'
            })
        }

        await Juego.findByIdAndDelete(id_juego)
        await JuegoTipoJuego.deleteMany({ id_juego })
        await Resena.deleteMany({ id_juego })

        return res.status(200).json({
            success: true,
            message: 'Juego eliminado con exito'
        })
    }
    catch(error){
        console.error('Error: ' + error)
        return res.status(500).json({
            success: false,
            message: 'No se pudo eliminar el juego'
        })
    }
})



// ========================== Reseñas ==========================

// --- Agregar Reseña ---
app.post('/agregar_resena', async (req, res) => {
    try{
        const {id_usuario, descripcion, id_juego} = req.body

        const buscar_juego = await Juego.findById(id_juego)

        if(!buscar_juego){
            return res.status(404).json({
                success: false,
                message: 'No se encontro el juego'
            })
        }

        const nueva_resena = new Resena({
            id_usuario, descripcion, id_juego
        })

        await nueva_resena.save()

        return res.status(201).json({
            success: true,
            message: 'Reseña agregada con exito'
        })
    }
    catch(error){
        console.error('Error: ' + error)
        return res.status(500).json({
            success: false,
            message: 'No se pudo agregar la reseña'
        })
    }
})

// --- obtener reseñas del usuario ---
app.post('/obtener_resenas_usuario', async (req, res) => {
    try{
        const {id_resena} = req.body

        const buscar_resena = await Resena.findById(id_resena).populate("id_juego", "nombre estado puntuacion horas_jugadas")

        if(!buscar_resena){
            return res.status(404).json({
                success: false,
                message: 'Esa reseña no existe'
            })
        }

        return res.status(200).json({
            success: true,
            data: buscar_resena
        })
    }
    catch(error){
        console.error('Error: ' + error) 
        return res.status(500).json({
            success: false,
            message: "No se pudo obtener la reseña"
        })
    }
})

// --- obtener una reseña por Id ---
app.post('/obtener_resena_id', async (req, res) => {
    try{
        const {id_resena} = req.body

        const buscar_resena = await Resena.findById(id_resena).populate("id_juego", "nombre estado puntuacion horas_jugadas")

        if(!buscar_resena){
            return res.status(404).json({
                success: false,
                message: 'Esa reseña no existe'
            })
        }

        return res.status(200).json({
            success: true,
            data: buscar_resena
        })
    }
    catch(error){
        console.error('Error: ' + error) 
        return res.status(500).json({
            success: false,
            message: "No se pudo obtener la reseña"
        })
    }
})

// --- obtener todas las reseñas de un juego ---
app.post('/obtener_resenas', async (req, res) => {
    try{
        const {id_juego} = req.body

        const buscar_resenas = await Resena.find({id_juego}).sort({createdAt: -1})

        return res.status(200).json({
            success: true,
            count: buscar_resenas.length,
            data: buscar_resenas
        })
    }
    catch(error){
        console.error('Error: ' + error) 
        return res.status(500).json({
            success: false,
            message: "No se pudo obtener las reseñas de ese juego"
        })
    }
})

// --- Editar Reseña ---
app.put('/editar_resena', async (req, res) => {
    try{
        const {nombre_autor, id_resena, descripcion} = req.body

        await Resena.findByIdAndUpdate(id_resena, {
            nombre_autor, descripcion
        }, {new: true})

        return res.status(200).json({
            success: true,
            message: 'Reseña editada con exito'
        })
    }
    catch(error){
        console.error('Error: ' + error)
        return res.status(500).json({
            success: false,
            message: 'No se pudo editar la reseña'
        })
    }
})

// --- Eliminar Reseña ---
app.post('/eliminar_resena', async (req, res) => {
    try{
        const {id_resena} = req.body

        const buscar_resena = await Resena.findById(id_resena)

        if(!buscar_resena){
            return res.status(404).json({
                success: false,
                message: 'No se encontro la reseña'
            })
        }

        await Resena.findByIdAndDelete(id_resena)

        return res.status(200).json({
            success: true,
            message: 'Reseña eliminada con exito'
        })
    }
    catch(error){
        console.error('Error: ' + error)
        return res.status(500).json({
            success: false,
            message: 'No se pudo eliminar la reseña'
        })
    }
})


// ========================== Tipos de Juegos ==========================

// --- Obtener los tipos de Juegos ---
app.get('/obtener_tipos_juegos', async (req, res) => {
    try{
        const buscar_tipos_juegos = await TipoJuego.find()

        return res.status(200).json({
            success: true,
            count: buscar_tipos_juegos.length,
            data: buscar_tipos_juegos
        })
    }
    catch(error){
        console.error('Error: ' + error)
        return res.status(500).json({
            success: false,
            message: 'No se pudo eliminar la reseña'
        })
    }
})


// ========================== Filtros ==========================

// --- Filtrar por estado del juego ---
app.post('/filtrar_nombre', async (req, res) => {
    try{
        const { nombre } = req.body

        const juegos = await Juego.find({
            nombre: { $regex: '^' + nombre, $options: 'i' }
        });

        if (!juegos || juegos.length === 0) {
            return res.status(200).json({
                success: false,
                message: 'No se encontraron juegos'
            })
        }

        // Buscar tipos y reseñas para cada juego
        const resultados = await Promise.all(
            juegos.map(async (juego) => {
                const tipos = await JuegoTipoJuego.find({ id_juego: juego._id })
                    .populate("id_tipo_juego", "nombre_tipo")

                const resenas = await Resena.find({ id_juego: juego._id })
                    .sort({ createdAt: -1 })

                return {
                    juego,
                    tipos,
                    cantidad_resenas: resenas.length,
                    resenas,
                }
            })
        );

        return res.status(200).json({
            success: true,
            data: resultados
        });
    }
    catch(error){
        console.error('Error: ' + error)
        return res.status(500).json({
            success: false,
            message: 'No se pudo buscar los juegos'
        })
    }
})


// --- Filtrar por tipo de juego ---
app.post('/filtrar_tipo_juego', async (req, res) => {
    try {
        const { id_tipo_juego } = req.body

        const relaciones = await JuegoTipoJuego.find({ id_tipo_juego })
            .populate('id_juego')
            .exec()

        // Buscar tipos y reseñas para cada juego
        const resultados = await Promise.all(
            relaciones.map(async (relacion) => {
                const tipos = await JuegoTipoJuego.find({ id_juego: relacion.id_juego._id })
                    .populate("id_tipo_juego", "nombre_tipo")

                const resenas = await Resena.find({ id_juego: relacion.id_juego._id })
                    .sort({ createdAt: -1 })

                return {
                    juego: relacion.id_juego,
                    tipos,
                    cantidad_resenas: resenas.length,
                    resenas,
                }
            })
        );

        return res.status(200).json({
            success: true,
            data: resultados,
        });
    } catch (error) {
        console.error('Error: ' + error);
        return res.status(500).json({
            success: false,
            message: 'No se pudo filtrar los juegos por su tipo de juego',
        })
    }
})


// --- Filtrar por estado del juego ---
app.post('/filtrar_estado', async (req, res) => {
    try{
        const {estado} = req.body

        const buscar_juegos = await Juego.find({estado})

        if(!buscar_juegos || buscar_juegos.length === 0){
            return res.status(404).json({
                success: false,
                message: 'No se encontraron juegos para ese tipo'
            })
        }

        // Buscar tipos y reseñas para cada juego
        const resultados = await Promise.all(
            buscar_juegos.map(async (juego) => {
                const tipos = await JuegoTipoJuego.find({ id_juego: juego._id })
                    .populate("id_tipo_juego", "nombre_tipo")

                const resenas = await Resena.find({ id_juego: juego._id })
                    .sort({ createdAt: -1 })

                return {
                    juego,
                    tipos,
                    cantidad_resenas: resenas.length,
                    resenas,
                }
            })
        );

        return res.status(200).json({
            success: true,
            data: resultados
        })
    }
    catch(error){
        console.error('Error: ' + error)
        return res.status(500).json({
            success: false,
            message: 'No se pudo filtrar los juegos por su estado'
        })
    }
})


// --- Filtrar por puntuacion del juego ---
app.post('/filtrar_puntuacion', async (req, res) => {
    try{
        const {puntuacion} = req.body

        const buscar_juegos = await Juego.find({puntuacion})

        if(!buscar_juegos || buscar_juegos.length === 0){
            return res.status(404).json({
                success: false,
                message: 'No se encontraron juegos para ese tipo'
            })
        }

        // Buscar tipos y reseñas para cada juego
        const resultados = await Promise.all(
            buscar_juegos.map(async (juego) => {
                const tipos = await JuegoTipoJuego.find({ id_juego: juego._id })
                    .populate("id_tipo_juego", "nombre_tipo")

                const resenas = await Resena.find({ id_juego: juego._id })
                    .sort({ createdAt: -1 })

                return {
                    juego,
                    tipos,
                    cantidad_resenas: resenas.length,
                    resenas,
                }
            })
        );

        return res.status(200).json({
            success: true,
            data: resultados
        })
    }
    catch(error){
        console.error('Error: ' + error)
        return res.status(500).json({
            success: false,
            message: 'No se pudo filtrar los juegos por su estado'
        })
    }
})



// ================================================================================
// ============================== Escucha del puerto ==============================
// ================================================================================
app.listen(3001, () => {
    console.log("Servidor Corriendo en http://localhost:3001")
})