var express = require('express');
var app = express();
var db = require('../database/database');
var fs = require('fs')

const cors = require('cors');
const bodyParser = require('body-parser');

const Dymo = require('dymojs');//,
const PORT = process.env.PORT || 4000;
       //dymo = new Dymo();

var corsOptions = {
  //origin: 'http://localhost:4200',
  //origin: 'http://169.254.168.35:4200', //PEER TO PEER
  //origin: 'http://192.168.0.100:4200', // CAPULUS
  origin: 'http://192.168.0.6:4200', // LOCAL
  //origin: 'http://192.168.0.102:4200', // ADRIAN
  //origin: 'https://192.168.0.4:4200', // LOCAL SSL
  //origin: 'http://172.20.10.6:4200', // INTERNET
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204 
};

var labelXml;

  app.use(bodyParser.json()); // for parsing application/json
  app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

  app.use(cors(corsOptions));

  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
 
app.listen(PORT, function () {
    console.log('Server is running.. on Port ' + PORT);
});

  //PING
  app.get('/', (req, res, next) => {
    log('Start', 'PING', 'Hello world!');
    db.query('SELECT $1::text as message', ['Hello world!'], (err, result) => {
      if (err) {
        return next(err);
      }
      fecha = new Date().toLocaleString();
      log('End', 'PING', 'Hello world!');
      res.send(result.rows[0]);
    })
  });

   //TODO Meter mas bien esta tavuel con querystring
  //https://stackoverflow.com/questions/6912584/how-to-get-get-query-string-variables-in-express-js-on-node-js
  //UN SOLO ASISTENTE PARA IMPRESION, TODOS LOS ATRIBUTOS DE IMPRESION
  app.get('/asistente/:idevento/impresion/:identificacion', (req, res, next) => {
    var listaAsistentes, listaAtributos;
    log('Start', 'ASISTENTES IMPRESION', req.params.identificacion);
    db.query('SELECT * FROM asistente WHERE idevento = $1 and identificacion = $2', 
    [req.params.idevento, req.params.identificacion], (err, result) => {
      if (err) {
        return next(err);
      }
      listaAsistentes = result.rows;
      db.query(`select aa.*, c.nombre 
              from asistente a 
              inner join atributosasistente aa
              on a.id = aa.idasistente
              inner join camposevento c
              on aa.idcampo = c.id
              where a.idevento = $1
              and a.identificacion = $2
              and c.ordenimpresion is not null
              order by c.ordenimpresion`, 
              [req.params.idevento, req.params.identificacion], (err, result) => {
        if (err) {
          return next(err);
        }
        listaAtributos = result.rows;
        log('End', 'ASISTENTES IMPRESION', req.params.identificacion);
        if(listaAsistentes.length == 0){
          res.send("{}");
        }else{
          res.send(arbolAsistentes(listaAsistentes, listaAtributos)[0]);
        }        
      });
    });
  });

  //TODO Meter mas bien esta tavuel con querystring
  //https://stackoverflow.com/questions/6912584/how-to-get-get-query-string-variables-in-express-js-on-node-js
  //UN SOLO ASISTENTE PARA CONTROL DE ACCESO, TODOS LOS ATRIBUTOS
  app.get('/asistente/:idevento/controlacceso/:identificacion', (req, res, next) => {
    var listaAsistentes, listaAtributos;
    log('Start', 'ASISTENTES CONTROL ACCESO', req.params.identificacion);
    db.query('SELECT * FROM asistente WHERE idevento = $1 and identificacion = $2', 
    [req.params.idevento, req.params.identificacion], (err, result) => {
      if (err) {
        return next(err);
      }
      listaAsistentes = result.rows;
      db.query(`select aa.*, c.nombre 
              from asistente a 
              inner join atributosasistente aa
              on a.id = aa.idasistente
              inner join camposevento c
              on aa.idcampo = c.id
              where a.idevento = $1
              and a.identificacion = $2`, 
              [req.params.idevento, req.params.identificacion], (err, result) => {
        if (err) {
          return next(err);
        }
        listaAtributos = result.rows;
        log('End', 'ASISTENTES CONTROL ACCESO', req.params.identificacion);
        res.send(arbolAsistentes(listaAsistentes, listaAtributos)[0]);
      });
    });
  });

  //RETORNA NOMBRE DE UN ASISTENTE
  app.get('/asistente/:idevento/nombre/:identificacion', (req, res, next) => {
    var listaAsistentes;
    log('Start', 'ASISTENTES NOMBRE', req.params.identificacion);
    db.query(`select aa.*
            from asistente a 
            inner join atributosasistente aa
            on a.id = aa.idasistente
            inner join camposevento c
            on aa.idcampo = c.id
            where a.idevento = $1
            and a.identificacion = $2
            and UPPER(c.nombre) = $3`, 
            [req.params.idevento, req.params.identificacion, "NOMBRE"], (err, result) => {
      if (err) {
        return next(err);
      }
      listaAsistentes = result.rows;
      log('End', 'ASISTENTES NOMBRE', req.params.identificacion);
      if(listaAsistentes.length == 0){
        res.send("{}");
      }else{
        res.send(listaAsistentes[0]);
      }
    });
  });

  //TODOS LOS ASISTENTES FILTRADOS, CON TODOS LOS ATRIBUTOS
  app.get('/asistente/:idevento/:criterio', (req, res, next) => {
    var listaAsistentes, listaAtributos;
    var listaCriterios, i;
    var sqlQuery, sqlEncabezado, sqlId;

    log('Start', 'ASISTENTES FILTRADO', req.params.criterio);
    listaCriterios = req.params.criterio.split(" ");
    for(i =0; i<listaCriterios.length; i++){
      listaCriterios[i] = '%' + listaCriterios[i] + '%';
    }
    listaCriterios.unshift(req.params.idevento);
    
    sqlEncabezado = `select DISTINCT a.* `;
    sqlId = 'select DISTINCT a.id ';
    sqlQuery = `from asistente a 
    inner join (
      select id
      from (`;
    for(i=1;i<listaCriterios.length;i++){
      sqlQuery += ` select idasistente as id, 
          aa.valor, 
          ` + i + ` llave
        from atributosasistente aa
        inner join camposevento c
          on aa.idcampo = c.id
        where c.idevento = $1
          and c.filtrar is not null
          and formatear(aa.valor, false) LIKE formatear($`+(i+1)+`, false) `;
      if(!isNaN(listaCriterios[i].substring(1,listaCriterios[i].length-1))){
        sqlQuery += ` UNION select id, 
            identificacion as valor, 
            ` + i + ` llave 
          from asistente 
          where idevento = $1
            and identificacion like $`+(i+1)+` `;
      }
      if(i<listaCriterios.length-1){
        sqlQuery += ` UNION `;
      }
    }
    sqlQuery +=` )res
      group by id
      having count(distinct(llave))>=` + (listaCriterios.length - 1) + `) res
    on a.id = res.id
    where a.idevento = $1`;
    db.query(sqlEncabezado + sqlQuery, 
              listaCriterios, (err, result) => {
      if (err) {
        return next(err);
      }
      listaAsistentes = result.rows;
      db.query(`select aa.*, c.nombre 
          from asistente a 
          inner join atributosasistente aa
          on a.id = aa.idasistente
          inner join camposevento c
          on aa.idcampo = c.id
          inner join (
          `+ sqlId + sqlQuery + 
          `) res 
          on a.id = res.id
          where a.idevento = $1
          and c.ordenregistro is not null
          order by c.ordenregistro`, listaCriterios, (err, result) => {
        if (err) {
          return next(err);
        }
        listaAtributos = result.rows;
        log('End', 'ASISTENTES FILTRADO', req.params.criterio);
        res.send(arbolAsistentes(listaAsistentes, listaAtributos));
      });
    });
  });

//TODOS LOS ASISTENTES PARA EXPORTAR, CON TODOS LOS ATRIBUTOS
app.get('/asistente/:idevento', (req, res, next) => {
  var listaAsistentes, listaAtributos;
  var sqlQuery;

  log('Start', 'ASISTENTES EXPORTAR', req.params.idevento);
    
  sqlQuery = `select * 
  from asistente
  where idevento = $1`;    
  
  db.query(sqlQuery, 
            [req.params.idevento], (err, result) => {
    if (err) {
      return next(err);
    }
    listaAsistentes = result.rows;
    db.query(`select aa.*, c.nombre 
        from asistente a 
        inner join atributosasistente aa
        on a.id = aa.idasistente
        inner join camposevento c
        on aa.idcampo = c.id
        where a.idevento = $1
        and c.ordenregistro is not null
        order by c.ordenregistro`, [req.params.idevento], (err, result) => {
      if (err) {
        return next(err);
      }
      listaAtributos = result.rows;
      log('End', 'ASISTENTES EXPORTAR', req.params.idevento);
      res.send(arbolAsistentes(listaAsistentes, listaAtributos));
    });
  });
});

  //INSERTA UN ASISTENTE CON SUS RESPECTIVOS ATRIBUTOS
  app.post('/asistente/:idevento', (req, res, next) => {
    var atributo, asistente;    
    log('Start', 'CREA ASISTENTE', req.body.identificacion);
    db.query(`INSERT INTO asistente(
                tipoid, identificacion, idevento, registrado, preinscrito)
              VALUES (1, $1, $2, $3, $4);`, 
              [req.body.identificacion, 
                req.params.idevento,
                req.body.registrado,
                req.body.preinscrito
              ], (err, result) => {
      if (err) {
        return next(err);
      }
      //res.status(201).send(req.body);    
      db.query('SELECT * FROM asistente WHERE idevento = $1 and identificacion = $2', 
        [req.params.idevento, req.body.identificacion], (err, result) => {
          if (err) {
            return next(err);
          }
          asistente = result.rows[0];
          for (i = 0; i < req.body.atributos.length; i += 1) {
            atributo = req.body.atributos[i];
            db.query(`INSERT INTO atributosasistente(
                  idasistente, idcampo, idvalorseleccionado, valor)
                  VALUES ($1, $2, $3, $4);`, 
                  [asistente.id, 
                    atributo.idcampo,
                    atributo.idvalorseleccionado,
                    atributo.valor
                  ], (err, result) => {
            if (err) {
            return next(err);
            }
            //res.status(201).send(req.body);    
            });
          }
          req.body.id = asistente.id;
          log('End', 'CREA ASISTENTE', req.body.identificacion);
          res.status(201).send(req.body);    //TODO Validar si es correcto el valor devuelto
        });
    });
  });

  //ACTUALIZA UN ASISTENTE CON SUS RESPECTIVOS ATRIBUTOS
  app.put('/asistente/:idevento', (req, res, next) => {
    log('Start', 'ACTUALIZA ASISTENTE', req.body.identificacion);
    db.query(`UPDATE asistente
              SET registrado = $3,
              actualizado = $4
              WHERE identificacion = $1
                AND idevento = $2;`, 
              [req.body.identificacion, 
                req.params.idevento,
                req.body.registrado,
                req.body.actualizado
              ], (err, result) => {
      if (err) {
        return next(err);
      }
      for (i = 0; i < req.body.atributos.length; i += 1) {
        atributo = req.body.atributos[i];
        db.query(`UPDATE atributosasistente
              SET idvalorseleccionado = $3,
                valor = $4
              WHERE idasistente = $1
                AND idcampo = $2;`, 
              [req.body.id, 
                atributo.idcampo,
                atributo.idvalorseleccionado,
                atributo.valor
              ], (err, result) => {
        if (err) {
        return next(err);
        }
        //res.status(201).send(req.body);    
        });
      }  
      log('End', 'ACTUALIZA ASISTENTE', req.body.identificacion);
      res.status(200).send(req.body);  //TODO Validar si es correcto el valor devuelto  
    });
  });

  //TODOS LOS CAMPOS DE UN EVENTO, CON POSIBLES VALORES
  app.get('/camposevento/:idevento/', (req, res, next) => {
    var listaCampos, listaPosiblesValores;
    log('Start', 'CAMPOS EVENTO', req.params.idevento);
    db.query(`select *
              from camposevento 
              where idevento = $1 
              and ordenregistro is not null
              order by ordenregistro`, 
              [req.params.idevento], (err, result) => { 
      if (err) {
        return next(err);
      }
      listaCampos = result.rows;
      db.query(`select pv.*
              from camposevento c
              inner join posiblesvalores pv
              on c.id = pv.idcampo
              where c.idevento = $1 
              and c.ordenregistro is not null
              order by c.ordenregistro`, 
              [req.params.idevento], (err, result) => {
        if (err) {
          return next(err);
        }
        listaPosiblesValores = result.rows;
        log('End', 'CAMPOS EVENTO', req.params.idevento);
        res.send(arbolCampos(listaCampos,listaPosiblesValores));
      });
    });
  });

  //TODAS LAS ZONAS DE UN EVENTO, CON SUS RESPECTIVAS RESTRICCIONES
  app.get('/zonas/:idevento/', (req, res, next) => {
    var listaZonas, listaRestriccionesZonas;
    log('Start', 'ZONAS', req.params.idevento);
    db.query(`select *
              from zona
              where idevento = $1
              `, 
              [req.params.idevento], (err, result) => { 
      if (err) {
        return next(err);
      }
      listaZonas = result.rows;
      db.query(`select rz.*
              from zona z
              inner join restriccioneszona rz
              on z.id = rz.idzona
              where z.idevento = $1 
              `, 
              [req.params.idevento], (err, result) => {
        if (err) {
          return next(err);
        }
        listaRestriccionesZonas = result.rows;
        log('End', 'ZONAS', req.params.idevento);
        res.send(arbolZonas(listaZonas, listaRestriccionesZonas));
      });
    });
  });

  //INSERTA UN MOVIMIENTO DE ASISTENCIA A ZONA
  app.post('/asistenciazona/:idevento', (req, res, next) => {
    var atributo, asistente;    
    log('Start', 'CREA ASISTENCIA ZONA', req.body.idasistente);
    db.query(`INSERT INTO asistenciazona(
                idzona, idasistente, idoperacion, fecha)
              VALUES ($1, $2, $3, current_timestamp);`, 
              [req.body.idzona, 
                req.body.idasistente,
                req.body.idoperacion
              ], (err, result) => {
      if (err) {
        return next(err);
      }
      log('End', 'CREA ASISTENCIA ZONA', req.body.idasistente);
      res.status(201).send(req.body);    //TODO Validar si es correcto el valor devuelto
    });
  });

  //CONSULTA LA ULTIMA ASISTENCIA A UNA ZONA
  app.get('/asistenciazona/:idevento/:idasistente/:idzona/:idoperacion', (req, res, next) => {
    var asistenciaszona;
    var sqlQuery;

    log('Start', 'CONSULTA ULTIMA ASISTENCIA', req.params.idasistente);
      
    sqlQuery = `
    select az.* 
    from asistenciazona az
    inner join zona z
    on az.idzona = z.id
    where z.idevento = $1
    and az.idasistente = $2
    and az.idzona = $3
    and (
      ($4 in (8, 9) and az.idoperacion in (8, 9))
      or ($4 = 10 and az.idoperacion = 10)
    )
    order by az.fecha desc`;    
    
    db.query(sqlQuery, 
              [req.params.idevento,
                req.params.idasistente,
                req.params.idzona,
                req.params.idoperacion], (err, result) => {
      if (err) {
        return next(err);
      }
      asistenciaszona = result.rows;
      log('End', 'CONSULTA ULTIMA ASISTENCIA', req.params.idasistente);
      if(asistenciaszona.length == 0){
        res.send("{}");
      }else{
        res.send(asistenciaszona[0]);
      }
    });
  });

  //#region Estadisticas
  //ESTADISTICA DE REGISTRADOS
  app.get('/estadisticas/registrados/:idevento', (req, res, next) => {
    var estadisticas;
    var sqlQuery;

    log('Start', 'ESTADISTICA REGISTRADOS', req.params.idevento);
      
    sqlQuery = `SELECT registrado, 
    count(1) cuenta
    FROM asistente
    WHERE idevento = $1
    GROUP BY registrado
    ORDER BY registrado`;    
    
    db.query(sqlQuery, 
              [req.params.idevento], (err, result) => {
      if (err) {
        return next(err);
      }
      estadisticas = result.rows;
      log('End', 'ESTADISTICA REGISTRADOS', req.params.idevento);
      res.send(estadisticas);
    });
  });

  //ESTADISTICA DE ASISTENTES
  app.get('/estadisticas/asistentes/:idevento', (req, res, next) => {
    var estadisticas;
    var sqlQuery;

    log('Start', 'ESTADISTICA ASISTENTES', req.params.idevento);
      
    sqlQuery = `SELECT preinscrito, 
    count(1) cuenta
    FROM asistente
    WHERE idevento = $1
    GROUP BY preinscrito
    ORDER BY preinscrito`;    
    
    db.query(sqlQuery, 
              [req.params.idevento], (err, result) => {
      if (err) {
        return next(err);
      }
      estadisticas = result.rows;
      log('End', 'ESTADISTICA ASISTENTES', req.params.idevento);
      res.send(estadisticas);
    });
  });

  //ESTADISTICA DE ACTUALIZADOS
  app.get('/estadisticas/actualizados/:idevento', (req, res, next) => {
    var estadisticas;
    var sqlQuery;

    log('Start', 'ESTADISTICA ACTUALIZADOS', req.params.idevento);
      
    sqlQuery = `SELECT actualizado, 
    count(1) cuenta
    FROM asistente
    WHERE idevento = $1
    GROUP BY actualizado
    ORDER BY actualizado`;    
    
    db.query(sqlQuery, 
              [req.params.idevento], (err, result) => {
      if (err) {
        return next(err);
      }
      estadisticas = result.rows;
      log('End', 'ESTADISTICA ACTUALIZADOS', req.params.idevento);
      res.send(estadisticas);
    });
  });

  //ESTADISTICA DE CERTIFICADOS
  app.get('/estadisticas/certificados/:idevento', (req, res, next) => {
    var estadisticas;
    var sqlQuery;

    log('Start', 'ESTADISTICA CERTIFICADOS', req.params.idevento);
      
    sqlQuery = `SELECT COUNT(DISTINCT a.idasistente) cuenta
    FROM asistenciazona a
    INNER JOIN zona z
    ON a.idzona = z.id
    WHERE z.idevento = $1
    AND a.idoperacion = 6
    `;    
    
    db.query(sqlQuery, 
              [req.params.idevento], (err, result) => {
      if (err) {
        return next(err);
      }
      estadisticas = result.rows;
      log('End', 'ESTADISTICA CERTIFICADOS', req.params.idevento);
      res.send(estadisticas);
    });
  });

  //ESTADISTICA POR OPERACION
  app.get('/estadisticas/operacion/:idevento', (req, res, next) => {
    var estadisticas;
    var sqlQuery;

    log('Start', 'ESTADISTICA OPERACION', req.params.idevento);
      
    sqlQuery = `SELECT a.idzona, a.idoperacion, COUNT(a.idasistente) cuenta, COUNT(DISTINCT(a.idasistente)) cuentaDistintos
    FROM asistenciazona a
    INNER JOIN zona z
      ON a.idzona = z.id
    WHERE z.idevento = $1
      AND a.idoperacion IN (8, 9, 10)
    GROUP BY a.idzona, a.idoperacion
    `;    
    
    db.query(sqlQuery, 
              [req.params.idevento], (err, result) => {
      if (err) {
        return next(err);
      }
      estadisticas = result.rows;
      log('End', 'ESTADISTICA OPERACION', req.params.idevento);
      res.send(estadisticas);
    });
  });

  //LINEA DE TIEMPO REGISTRADOS
  app.get('/estadisticas/registradostimeline/:idevento', (req, res, next) => {
    var estadisticas;
    var sqlQuery;

    log('Start', 'TIMELINE REGISTRADOS', req.params.idevento);
      
    sqlQuery = `SELECT to_char(a.fecha, 'YYYY/MM/DD') dia, 
          to_char(a.fecha, 'HH12 AM') hora,
          to_char(a.fecha, 'HH24') horaNumerico,
          COUNT(DISTINCT a.registrados) registrados,
          COUNT(DISTINCT a.escarapelas) escarapelas,
          COUNT(DISTINCT a.certificados) certificados
      FROM 
      (SELECT a.fecha, 
      CASE idoperacion WHEN 3 THEN a.idasistente ELSE null END AS registrados, 
      CASE WHEN idoperacion = 4 OR idoperacion = 5 THEN a.idasistente ELSE null END AS escarapelas,
      CASE idoperacion WHEN 6 THEN a.idasistente ELSE null END AS certificados
      FROM
      asistenciazona a
      INNER JOIN zona z
      ON a.idzona = z.id
      WHERE z.idevento = $1
          AND a.idoperacion between 3 and 6) a
      GROUP BY 
      to_char(a.fecha, 'YYYY/MM/DD'), 
          to_char(a.fecha, 'HH12 AM'),
          to_char(a.fecha, 'HH24')
      ORDER BY 1, 3
    `;    
    
    db.query(sqlQuery, 
              [req.params.idevento], (err, result) => {
      if (err) {
        return next(err);
      }
      estadisticas = result.rows;
      log('End', 'TIMELINE REGISTRADOS', req.params.idevento);
      res.send(estadisticas);
    });
  });

  //LINEA DE TIEMPO ZONAS
  app.get('/estadisticas/zonastimeline/:idevento/:idzona', (req, res, next) => {
    var estadisticas;
    var sqlQuery;

    log('Start', 'TIMELINE ZONAS', req.params.idzona);
      
    sqlQuery = `WITH a AS (SELECT a.fecha, 
        z.nombre,
        CASE idoperacion WHEN 8 THEN a.idasistente ELSE null END AS asistentes_entradas, 
        CASE idoperacion WHEN 9 THEN a.idasistente ELSE null END AS asistentes_salidas,
        CASE idoperacion WHEN 10 THEN a.idasistente ELSE null END AS asistentes_entregas
      FROM
        asistenciazona a
      INNER JOIN zona z
        ON a.idzona = z.id
      WHERE z.idevento = $1
   	    AND z.id = $2
        AND a.idoperacion between 8 and 10
          )     
      SELECT to_char(a.fecha, 'YYYY/MM/DD') dia, 
          to_char(a.fecha, 'HH12 AM') hora,
          to_char(a.fecha, 'HH24') horaNumerico,
          MAX(a.entradas) entradas,
          MAX(a.salidas) salidas,
          MAX(a.entregas) entregas,
          MAX(a.entradasdistintos) entradasdistintos,
          MAX(a.salidasdistintos) salidasdistintos,
          MAX(a.entregasdistintos) entregasdistintos
      FROM(
        SELECT a.fecha, 
          (SELECT COUNT(b.asistentes_entradas) FROM a b WHERE b.fecha <= a.fecha) as entradas,
          (SELECT COUNT(b.asistentes_salidas) FROM a b WHERE b.fecha <= a.fecha) as salidas,
          (SELECT COUNT(b.asistentes_entregas) FROM a b WHERE b.fecha <= a.fecha) as entregas,
          (SELECT COUNT(DISTINCT b.asistentes_entradas) FROM a b WHERE b.fecha <= a.fecha) as entradasdistintos,
          (SELECT COUNT(DISTINCT b.asistentes_salidas) FROM a b WHERE b.fecha <= a.fecha) as salidasdistintos,
          (SELECT COUNT(DISTINCT b.asistentes_entregas) FROM a b WHERE b.fecha <= a.fecha) as entregasdistintos
        FROM a
      ) a
      GROUP BY 
        to_char(a.fecha, 'YYYY/MM/DD'), 
        to_char(a.fecha, 'HH12 AM'),
        to_char(a.fecha, 'HH24')
      ORDER BY 1, 3
    `;    
    
    db.query(sqlQuery, 
              [req.params.idevento,
                req.params.idzona], (err, result) => {
      if (err) {
        return next(err);
      }
      estadisticas = result.rows;
      log('End', 'TIMELINE ZONAS', req.params.idzona);
      res.send(estadisticas);
    });
  });

  //ESTADISTICA DE CAMPOS
  app.get('/estadisticas/:idevento/campos/:idcampo', (req, res, next) => {
    var estadisticas;
    var sqlQuery;

    log('Start', 'ESTADISTICA CAMPOS', req.params.idcampo);
      
    sqlQuery = `SELECT valor, 
    count(1) cuenta
    FROM atributosasistente aa
    INNER JOIN asistente a
    ON aa.idasistente = a.id
    WHERE idcampo = $2
    AND a.idevento = $1
    AND a.registrado = true
    GROUP BY valor
    ORDER BY count(1) DESC`;    
    
    db.query(sqlQuery, 
              [req.params.idevento, req.params.idcampo], (err, result) => {
      if (err) {
        return next(err);
      }
      estadisticas = result.rows;
      log('End', 'ESTADISTICA CAMPOS', req.params.idcampo);
      res.send(estadisticas);
    });
  });
  //#endregion

  //#region Impresion
  //IMPRESION USANDO SERVICIO DE DYMO
  app.post('/imprimir/:idevento/:identificacion', (req, res, next) => {
    var listaAtributos;
    log('Start', 'IMPRESION', req.params.identificacion);
    let options = {
      //hostname: "localhost"
      hostname: "127.0.0.1"
    };
    let dymo= new Dymo(options);
    
    //let labelXml = req.body.labelXml;
    
    //if(labelXml != null){
    //  return labelXml;
    //}else{
      fs.readFile('./labels/escarapela.label', 'utf8', function (err,data) {
        if (err) {
          console.log(err);
        }
        //labelXml = data.split("\r").join("");
        labelXml = data;
        labelXml = labelXml.substring(labelXml.indexOf("<DieCutLabel"));
        var labelXml2 = `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
	<PaperOrientation>Landscape</PaperOrientation>
	<Id>Address</Id>
	<IsOutlined>false</IsOutlined>
	<PaperName>30252 Address</PaperName>
	<DrawCommands>
		<RoundRectangle X="0" Y="0" Width="1581" Height="5040" Rx="270" Ry="270" />
	</DrawCommands>
	<ObjectInfo>
		<TextObject>
			<Name>Texto</Name>
			<ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
			<BackColor Alpha="0" Red="255" Green="255" Blue="255" />
			<LinkedObjectName />
			<Rotation>Rotation0</Rotation>
			<IsMirrored>False</IsMirrored>
			<IsVariable>True</IsVariable>
			<GroupID>-1</GroupID>
			<IsOutlined>False</IsOutlined>
			<HorizontalAlignment>Center</HorizontalAlignment>
			<VerticalAlignment>Middle</VerticalAlignment>
			<TextFitMode>ShrinkToFit</TextFitMode>
			<UseFullFontHeight>True</UseFullFontHeight>
			<Verticalized>False</Verticalized>
			<StyledText>
				<Element>
					<String xml:space="preserve">{1}
</String>
					<Attributes>
						<Font Family="Arial" Size="20" Bold="False" Italic="False" Underline="False" Strikeout="False" />
						<ForeColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100" />
					</Attributes>
				</Element>
				<Element>
					<String xml:space="preserve">{3}
</String>
					<Attributes>
						<Font Family="Arial" Size="12" Bold="False" Italic="False" Underline="False" Strikeout="False" />
						<ForeColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100" />
					</Attributes>
				</Element>
				<Element>
					<String xml:space="preserve">{2}</String>
					<Attributes>
						<Font Family="Arial" Size="20" Bold="True" Italic="False" Underline="False" Strikeout="False" />
						<ForeColor Alpha="255" Red="0" Green="0" Blue="0" HueScale="100" />
					</Attributes>
				</Element>
			</StyledText>
		</TextObject>
		<Bounds X="331" Y="150" Width="4560" Height="1343" />
	</ObjectInfo>
</DieCutLabel>
        `
      //labelXml = leerLabel();

      db.query(`select aa.valor, c.nombre, c.ordenimpresion 
                from asistente a 
                inner join atributosasistente aa
                on a.id = aa.idasistente
                inner join camposevento c
                on aa.idcampo = c.id
                where a.idevento = $1
                and a.identificacion = $2
                and c.ordenimpresion is not null
                order by c.ordenimpresion`, 
                [req.params.idevento, req.params.identificacion], (err, result) => {
          if (err) {
            return next(err);
          }
          listaAtributos = result.rows;
          if(listaAtributos.length == 0){
            log('End', 'IMPRESION', req.params.identificacion);
            res.send("{}");
          }else{
            labelXml = labelXml.replace("IDENT");
            listaAtributos.forEach(atributo => {
              labelXml = labelXml.replace("{" + atributo.ordenimpresion +"}", atributo.valor.trim())
            });
            let resultado = dymo.print(req.body.nombreImpresora, labelXml).then((result) => {
              console.log(result);
            });      
            log('End', 'IMPRESION', req.params.identificacion);
            res.status(201).send(req.body);    //TODO Validar si es correcto el valor devuelto
          }        
        });
      });
    //}
  });

  //DEVUELVE EL LISTADO DE IMPRESORAS DISPONIBLES
  app.get('/listaimpresoras/', (req, res, next) => {
    var listaAtributos;
    log('Start', 'LISTA IMPRESORAS', 0);
    let options = {
      //hostname: "127.0.0.1"
      hostname: "192.168.0.7"
    };
    let dymo= new Dymo(options);
    let resultado = dymo.getPrinters().then((printersResponseText) => {
      log('End', 'LISTA IMPRESORAS', 0);
      res.send(xmlToJson(printersResponseText));
    });
  });
  
  //TODAS LAS IMPRESORAS CON SU IP
  app.get('/impresoras/:idevento/', (req, res, next) => {
    var listaImpresoras;
    log('Start', 'IMPRESORAS', req.params.idevento);
    db.query(`select DISTINCT ip
              from impresoras
              where idevento = $1
              `, 
              [req.params.idevento], (err, result) => { 
      if (err) {
        return next(err);
      }
      listaImpresoras = result.rows;
      log('End', 'IMPRESORAS', req.params.idevento);
      res.send(listaImpresoras);
    });
  });
  //#endregion

function arbolAsistentes(listaPadre, listaHijos) {
  try{
    var nodoPadre, nodoHijo, roots = [], i, j;
    for (i = 0; i < listaPadre.length; i += 1) {
      nodoPadre = listaPadre[i];
      nodoPadre.atributos = [];
    }
    for (i = 0; i < listaPadre.length; i += 1) {
      nodoPadre = listaPadre[i];
      for (j = 0; j < listaHijos.length; j += 1) {
        nodoHijo = listaHijos[j];
        if (nodoHijo.idasistente == nodoPadre.id) {
            nodoPadre.atributos.push(nodoHijo);
        } 
      }
      roots.push(nodoPadre);
    }
    return roots;
  }
  catch(error){
    console.log(error);
  }
  return null;
}

function arbolCampos(listaPadre, listaHijos) {
  try{
    var nodoPadre, nodoHijo, roots = [], i, j;
    for (i = 0; i < listaPadre.length; i += 1) {
      nodoPadre = listaPadre[i];
      nodoPadre.posiblesvalores = [];
    }
    for (i = 0; i < listaPadre.length; i += 1) {
      nodoPadre = listaPadre[i];
      for (j = 0; j < listaHijos.length; j += 1) {
        nodoHijo = listaHijos[j];
        if (nodoHijo.idcampo == nodoPadre.id) {
            nodoPadre.posiblesvalores.push(nodoHijo);
        } 
      }
      roots.push(nodoPadre);
    }
    return roots;
  }
  catch(error){
    console.log(error);
  }
  return null;
}

function arbolZonas(listaPadre, listaHijos) {
  try{
    var nodoPadre, nodoHijo, roots = [], i, j;
    for (i = 0; i < listaPadre.length; i += 1) {
      nodoPadre = listaPadre[i];
      nodoPadre.restriccioneszona = [];
    }
    for (i = 0; i < listaPadre.length; i += 1) {
      nodoPadre = listaPadre[i];
      for (j = 0; j < listaHijos.length; j += 1) {
        nodoHijo = listaHijos[j];
        if (nodoHijo.idzona == nodoPadre.id) {
            nodoPadre.restriccioneszona.push(nodoHijo);
        } 
      }
      roots.push(nodoPadre);
    }
    return roots;
  }
  catch(error){
    console.log(error);
  }
  return null;
}

function log(tipo, metodo, parametro){
  var fecha = new Date().toLocaleString();
  var milisegundos = new Date().getMilliseconds();
  console.log(tipo + ':' + metodo + ':' + parametro + ':' + fecha + '.' + milisegundos);
}

function leerLabel(){
  try{
  if(labelXml != null){
    return labelXml;
  }else{
    fs.readFile('./labels/escarapela.label', 'utf8', function (err,data) {
      if (err) {
        console.log(err);
      }
      console.log(data);
      labelXml = data;
    });
    return labelXml;
  }
  }catch(error){
    console.log(error);
  }
}

// Convierte el response XML de DYMO en JSON
function xmlToJson(xml) {
  var lista = [];
  var indice = 0;
  while(xml.indexOf("<LabelWriterPrinter>", indice) >= 0){
    var impresora = {};
    impresora.nombre = xml.substring(xml.indexOf("<Name", indice) + 6 , xml.indexOf("/Name>", indice) - 2);
    impresora.activa = xml.substring(xml.indexOf("<IsConnected", indice) + 13 , xml.indexOf("/IsConnected>", indice) - 2);
    if(impresora.activa == "True"){
      lista.push(impresora);
    }
    indice = xml.indexOf("/IsConnected>", indice) + 3;
  }
	return lista;
};
