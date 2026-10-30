/**
 * Schedule2 · Motor de restricciones. NO confía en el navegador.
 * Un registro compartido ocupa una sola aula/docente y aparece en varias carreras.
 */
function exigir_(cond,mensaje){if(!cond)throw new Error(mensaje);}
function uno_(arr,key,id){return arr.find(function(x){return x[key]===id;});}
function solapa_(a,b){return a.inicio<b.fin && b.inicio<a.fin;}
function abierto_(d){exigir_(d.periodo.estado==='ABIERTO','Período cerrado: solo lectura.');}
function unidad_(d,ids) {
  exigir_(Array.isArray(ids)&&ids.length>0&&ids.length<=12,'Seleccione entre 1 y 12 ofertas.');
  var distinct=Array.from(new Set(ids.map(String)));
  exigir_(distinct.length===ids.length,'Ofertas duplicadas.');
  var ofertas=distinct.map(function(id){return uno_(d.Ofertas,'oferta_id',id);});
  exigir_(ofertas.every(Boolean),'Existe una oferta no registrada.');
  ofertas.forEach(function(o){
    exigir_(activo_(o.activa),'Oferta deshabilitada: '+o.oferta_id);
    exigir_(o.periodo_id===d.periodo.periodo_id,'La oferta pertenece a otro período.');
    var g=uno_(d.Grupos,'grupo_id',o.grupo_id),c=uno_(d.Carreras,'carrera_id',o.carrera_id),a=uno_(d.Asignaturas,'asignatura_id',o.asignatura_id);
    exigir_(g&&activo_(g.activo)&&g.carrera_id===o.carrera_id,'Grupo inválido en '+o.oferta_id);
    exigir_(g.turno_id===o.turno_id,'Turno del grupo diferente al de la oferta.');
    exigir_(c&&activo_(c.activa)&&a&&activo_(a.activa),'Carrera o asignatura inactiva.');
    exigir_(Number(o.sesiones_semana)>=1&&Number(o.bloques_sesion)>=1,'Sesiones/bloques deben ser positivos.');
    exigir_(uno_(d.Turnos,'turno_id',o.turno_id),'Turno inexistente.');
    exigir_((Number(o.matricula)||Number(g.matricula))>0,'Matrícula inválida; registre estudiantes.');
  });
  var first=ofertas[0];
  exigir_(ofertas.every(function(o){return o.asignatura_id===first.asignatura_id&&o.turno_id===first.turno_id&&Number(o.sesiones_semana)===Number(first.sesiones_semana)&&Number(o.bloques_sesion)===Number(first.bloques_sesion);}), 'Las ofertas compartidas deben tener igual asignatura, turno y carga.');
  var combinacion='';
  if (first.combinacion_id||ofertas.length>1) {
    combinacion=first.combinacion_id;
    var comb=uno_(d.Combinaciones,'combinacion_id',combinacion);
    exigir_(comb&&activo_(comb.activa)&&comb.periodo_id===d.periodo.periodo_id,'Combinación no aprobada.');
    var previstos=dividir_(comb.oferta_ids).sort();
    exigir_(previstos.length===distinct.length && previstos.join('|')===distinct.slice().sort().join('|'),'Debe incluir exactamente las ofertas aprobadas de la combinación.');
    exigir_(ofertas.every(function(o){return o.combinacion_id===combinacion;}),'Combinación inconsistente.');
    exigir_(activo_(uno_(d.Asignaturas,'asignatura_id',first.asignatura_id).compartible),'La asignatura no permite combinación.');
  }
  var grupos=ofertas.map(function(o){return o.grupo_id;});
  exigir_(new Set(grupos).size===grupos.length,'No se puede combinar el mismo grupo dos veces.');
  var carreras=Array.from(new Set(ofertas.map(function(o){return o.carrera_id;})));
  var matricula=ofertas.reduce(function(n,o){return n+Number(o.matricula||uno_(d.Grupos,'grupo_id',o.grupo_id).matricula);},0);
  var tipos=Array.from(new Set(ofertas.map(function(o){return String(o.tipo_espacio||'AULA').toUpperCase();})));
  exigir_(tipos.length===1,'Las ofertas combinadas necesitan el mismo tipo de espacio.');
  var docentes=Array.from(new Set(ofertas.map(function(o){return o.docente_id;}).filter(Boolean)));
  exigir_(docentes.length<=1,'Las ofertas combinadas tienen docentes obligatorios diferentes.');
  return {ofertas:ofertas,ids:distinct,grupos:grupos,carreras:carreras,asignatura:first.asignatura_id,turno:first.turno_id,sesiones:Number(first.sesiones_semana),bloques:Number(first.bloques_sesion),matricula:matricula,tipo:tipos[0],docenteFijo:docentes[0]||'',combinacion:combinacion};
}
function horarioDeBloques_(d,unidad,dia,bloqueIds){
  exigir_(DIAS.indexOf(dia)!==-1,'Día inválido.');
  exigir_(Array.isArray(bloqueIds)&&bloqueIds.length===unidad.bloques,'Cantidad de bloques incorrecta.');
  var slots=d.Bloques.filter(function(b){return b.turno_id===unidad.turno&&b.dia===dia&&activo_(b.activo);}).sort(function(a,b){return Number(a.orden)-Number(b.orden);});
  var indices=bloqueIds.map(function(id){return slots.findIndex(function(s){return s.bloque_id===id;});});
  exigir_(indices.every(function(i){return i>=0;}),'Un bloque no está disponible para ese día y turno.');
  exigir_(new Set(indices).size===indices.length,'Bloques repetidos.');
  exigir_(indices.every(function(i,k){return i===indices[0]+k;}),'Los bloques deben ser consecutivos y ordenados.');
  var init=minutos_(slots[indices[0]].inicio),end=minutos_(slots[indices[indices.length-1]].fin);
  exigir_(Number.isFinite(init)&&Number.isFinite(end)&&end>init,'Horas de bloques inválidas.');
  for(var i=1;i<indices.length;i++){
    var prev=slots[indices[i-1]],next=slots[indices[i]];
    var gap=minutos_(next.inicio)-minutos_(prev.fin);
    exigir_(gap>=0&&gap<=30,'Hay una separación excesiva o solapamiento entre bloques.');
  }
  var turno=uno_(d.Turnos,'turno_id',unidad.turno);
  exigir_(activo_(turno.activo),'Turno deshabilitado.');
  exigir_(init>=minutos_(turno.entrada)&&end<=minutos_(turno.salida),'Fuera del horario de entrada/salida.');
  [['receso_inicio','receso_fin','receso'],['almuerzo_inicio','almuerzo_fin','almuerzo']].forEach(function(b){
    if(turno[b[0]]&&turno[b[1]]){
      exigir_(!solapa_({inicio:init,fin:end},{inicio:minutos_(turno[b[0]]),fin:minutos_(turno[b[1]])}),'Coincide con '+b[2]+'.');
    }
  });
  return {inicio:init,fin:end,inicioTexto:slots[indices[0]].inicio,finTexto:slots[indices[indices.length-1]].fin};
}
function validar_(d,u,entrada,excluirId) {
  var unidad=unidad_(d,entrada.ofertaIds);
  exigir_(puedeEditar_(u,unidad.carreras),'No puede modificar carreras de otra coordinación.');
  var room=uno_(d.Aulas,'aula_id',entrada.aulaId),teacher=uno_(d.Docentes,'docente_id',entrada.docenteId);
  exigir_(room&&activo_(room.activa),'Aula inexistente o deshabilitada.');
  exigir_(teacher&&activo_(teacher.activo),'Docente inexistente o deshabilitado.');
  exigir_(String(room.tipo).toUpperCase()===unidad.tipo,'La clase requiere espacio '+unidad.tipo+'.');
  exigir_(Number(room.capacidad)>0&&unidad.matricula<=Number(room.capacidad),'Capacidad insuficiente ('+unidad.matricula+' estudiantes, aula admite '+room.capacidad+'). Divida el grupo o asigne un espacio mayor.');
  exigir_(!unidad.docenteFijo||teacher.docente_id===unidad.docenteFijo,'La oferta tiene otro docente asignado.');
  var asignatura=uno_(d.Asignaturas,'asignatura_id',unidad.asignatura);
  exigir_(d.DocenteAreas.some(function(x){return x.docente_id===teacher.docente_id&&x.area_id===asignatura.area_id;}),'El docente no está habilitado para el área '+asignatura.area_id+'.');
  var time=horarioDeBloques_(d,unidad,entrada.dia,entrada.bloqueIds);
  var disp=d.Disponibilidad.filter(function(x){return x.docente_id===entrada.docenteId&&x.dia===entrada.dia;});
  var bloqueos=disp.filter(function(x){return !activo_(x.disponible);});
  exigir_(!bloqueos.some(function(x){return solapa_(time,{inicio:minutos_(x.inicio),fin:minutos_(x.fin)});}), 'Docente no disponible a esa hora.');
  var disponibles=disp.filter(function(x){return activo_(x.disponible);});
  exigir_(!disponibles.length||disponibles.some(function(x){return time.inicio>=minutos_(x.inicio)&&time.fin<=minutos_(x.fin);}), 'El horario queda fuera de la disponibilidad del docente.');
  var asignadas=d.Asignaciones.filter(function(x){return x.asignacion_id!==excluirId;});
  unidad.ids.forEach(function(id){
    exigir_(asignadas.filter(function(a){return dividir_(a.oferta_ids).indexOf(id)>=0;}).length<unidad.sesiones,'Se alcanzaron las sesiones semanales de la oferta '+id+'.');
  });
  asignadas.forEach(function(a){
    if (a.dia!==entrada.dia)return;
    if(!solapa_(time,{inicio:minutos_(a.inicio),fin:minutos_(a.fin)}))return;
    exigir_(a.aula_id!==entrada.aulaId,'Aula ocupada por otra coordinación o carrera.');
    exigir_(a.docente_id!==entrada.docenteId,'Docente ocupado en otra asignatura.');
    exigir_(!dividir_(a.grupo_ids).some(function(id){return unidad.grupos.indexOf(id)>=0;}),'Grupo ya tiene clase en esa hora.');
  });
  var turno=uno_(d.Turnos,'turno_id',unidad.turno),max=Number(turno.max_bloques_dia)||999;
  unidad.grupos.forEach(function(id){
    var cnt=asignadas.filter(function(a){return a.dia===entrada.dia&&dividir_(a.grupo_ids).indexOf(id)>=0;}).reduce(function(n,a){return n+dividir_(a.bloque_ids).length;},0);
    exigir_(cnt+unidad.bloques<=max,'El grupo '+id+' supera el máximo diario de '+max+' bloques.');
  });
  return {unidad:unidad,time:time};
}
function crearRegistro_(d,u,entrada,anterior) {
  var checked=validar_(d,u,entrada,anterior?anterior.asignacion_id:'');
  var unit=checked.unidad,now=new Date().toISOString();
  return {asignacion_id:anterior?anterior.asignacion_id:Utilities.getUuid(),periodo_id:d.periodo.periodo_id,oferta_ids:unit.ids.join('|'),carrera_ids:unit.carreras.join('|'),grupo_ids:unit.grupos.join('|'),asignatura_id:unit.asignatura,turno_id:unit.turno,dia:entrada.dia,bloque_ids:entrada.bloqueIds.join('|'),inicio:checked.time.inicioTexto,fin:checked.time.finTexto,aula_id:entrada.aulaId,docente_id:entrada.docenteId,estudiantes:unit.matricula,combinacion_id:unit.combinacion,propietario:anterior?anterior.propietario:u.correo,version:anterior?Number(anterior.version)+1:1,creado:anterior?anterior.creado:now,actualizado:now};
}
function conBloqueo_(fn) {
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try{return fn();} finally{lock.releaseLock();}
}
function apiGuardar(periodoId,entrada) {
  var u=usuario_();exigir_(entrada&&typeof entrada==='object','Datos faltantes.');
  return conBloqueo_(function(){
    var m=maestro_(),d=datos_(m,String(periodoId));abierto_(d);
    var old=entrada.asignacionId?uno_(d.Asignaciones,'asignacion_id',entrada.asignacionId):null;
    if(entrada.asignacionId) exigir_(old,'El registro ya no existe. Recargue el horario.');
    if(old){
      exigir_(puedeEditar_(u,dividir_(old.carrera_ids)),'No puede editar un horario de otra coordinación.');
      exigir_(Number(old.version)===Number(entrada.version),'Otro usuario modificó este registro. Recargue antes de editar.');
      exigir_(dividir_(old.oferta_ids).slice().sort().join('|')===entrada.ofertaIds.slice().sort().join('|'),'No puede cambiar ofertas mediante una edición; elimine y cree de nuevo.');
    }
    var item=crearRegistro_(d,u,entrada,old);
    if(old)d.Asignaciones=d.Asignaciones.map(function(x){return x.asignacion_id===old.asignacion_id?item:x;});
    else d.Asignaciones.push(item);
    sobrescribirTabla_(d.libro,'Asignaciones',d.Asignaciones);
    regenerarVistas_(d);
    registrar_(m,u.correo,old?'EDITAR':'CREAR',periodoId,item.asignacion_id,item.oferta_ids);
    return {registro:item,asignaciones:d.Asignaciones};
  });
}
function apiEliminar(periodoId,id,version){
  var u=usuario_();
  return conBloqueo_(function(){
    var m=maestro_(),d=datos_(m,String(periodoId));abierto_(d);
    var old=uno_(d.Asignaciones,'asignacion_id',String(id));
    exigir_(old,'Registro no encontrado.');
    exigir_(puedeEditar_(u,dividir_(old.carrera_ids)),'No puede eliminar una clase ajena.');
    exigir_(Number(old.version)===Number(version),'Versión desactualizada. Recargue.');
    d.Asignaciones=d.Asignaciones.filter(function(x){return x.asignacion_id!==id;});
    sobrescribirTabla_(d.libro,'Asignaciones',d.Asignaciones);regenerarVistas_(d);
    registrar_(m,u.correo,'ELIMINAR',periodoId,id,old.oferta_ids);
    return {asignaciones:d.Asignaciones};
  });
}
function candidatosUnidades_(d,u,carreraId) {
  var offers=d.Ofertas.filter(function(x){return x.periodo_id===d.periodo.periodo_id&&activo_(x.activa)&&x.carrera_id===carreraId;});
  var out=[],seen={};
  offers.forEach(function(o){
    if(o.combinacion_id){
      if(seen[o.combinacion_id])return;
      seen[o.combinacion_id]=true;
      var c=uno_(d.Combinaciones,'combinacion_id',o.combinacion_id);
      if (!c||!activo_(c.activa))return;
      var ids=dividir_(c.oferta_ids);
      var members=ids.map(function(id){return uno_(d.Ofertas,'oferta_id',id);});
      if(members.some(function(x){return !x;}))return;
      if(!puedeEditar_(u,members.map(function(x){return x.carrera_id;})))return;
      out.push(ids);
    } else out.push([o.oferta_id]);
  });
  return out;
}
function profesores_(d,unit){
  var area=uno_(d.Asignaturas,'asignatura_id',unit.asignatura).area_id;
  return d.Docentes.filter(function(t){return activo_(t.activo)&&(!unit.docenteFijo||unit.docenteFijo===t.docente_id)&&d.DocenteAreas.some(function(x){return x.docente_id===t.docente_id&&x.area_id===area;});}).sort(function(a,b){return a.nombre.localeCompare(b.nombre);});
}
function generar_(d,u,carreraId) {
  abierto_(d);
  exigir_(puedeEditar_(u,[carreraId]),'Sin permiso sobre esa carrera.');
  var unidades=candidatosUnidades_(d,u,carreraId).map(function(ids){return unidad_(d,ids);});
  unidades.sort(function(a,b){return (b.matricula-a.matricula)||(b.bloques-a.bloques);});
  var nuevas=[],advertencias=[],omitidas=0;
  unidades.forEach(function(unit){
    var existentes=d.Asignaciones.filter(function(a){return dividir_(a.oferta_ids).indexOf(unit.ids[0])>=0;}).length;
    var faltan=Math.max(0,unit.sesiones-existentes);
    omitidas+=existentes;
    for(var sesion=0;sesion<faltan;sesion++){
      var posibles=[],ultimasRazones={};
      var teachers=profesores_(d,unit);
      var rooms=d.Aulas.filter(function(r){return activo_(r.activa)&&String(r.tipo).toUpperCase()===unit.tipo&&Number(r.capacidad)>=unit.matricula;}).sort(function(a,b){return Number(a.capacidad)-Number(b.capacidad);});
      if(!teachers.length)ultimasRazones['Sin docente habilitado']='';
      if(!rooms.length)ultimasRazones['Sin aula con capacidad '+unit.matricula+' y tipo '+unit.tipo]='';
      var dias=Array.from(new Set(d.Bloques.filter(function(x){return x.turno_id===unit.turno&&activo_(x.activo);}).map(function(x){return x.dia;})));
      dias.forEach(function(dia){
        var slots=d.Bloques.filter(function(b){return b.turno_id===unit.turno&&b.dia===dia&&activo_(b.activo);}).sort(function(a,b){return Number(a.orden)-Number(b.orden);});
        for(var k=0;k+unit.bloques<=slots.length;k++){
          var ids=slots.slice(k,k+unit.bloques).map(function(s){return s.bloque_id;});
          rooms.forEach(function(room){
            teachers.forEach(function(teacher){
              var entrada={ofertaIds:unit.ids,dia:dia,bloqueIds:ids,aulaId:room.aula_id,docenteId:teacher.docente_id};
              try {
                validar_(d,u,entrada,'');
                var dayLoad=d.Asignaciones.filter(function(a){return a.dia===dia&&dividir_(a.grupo_ids).some(function(g){return unit.grupos.indexOf(g)>=0;});}).length;
                var teacherLoad=d.Asignaciones.filter(function(a){return a.docente_id===teacher.docente_id;}).length;
                var score=dayLoad*100+teacherLoad*4+k+(Number(room.capacidad)-unit.matricula)/1000;
                posibles.push({entrada:entrada,score:score});
              } catch(e) {ultimasRazones[String(e.message)]=true;}
            });
          });
        }
      });
      posibles.sort(function(a,b){return a.score-b.score;});
      if(posibles.length){
        var item=crearRegistro_(d,u,posibles[0].entrada,null);
        d.Asignaciones.push(item);nuevas.push(item);
      } else {
        var razones=Object.keys(ultimasRazones);
        advertencias.push('Sin espacio para '+unit.ids.join(' + ')+': '+(razones.slice(0,3).join('; ')||'No existe combinación viable.'));
      }
    }
  });
  return {nuevas:nuevas,omitidas:omitidas,advertencias:advertencias,asignaciones:d.Asignaciones};
}
/** La simulación es informativa y la escritura vuelve a calcular bajo LockService. */
function apiGenerar(periodoId,carreraId,simular){
  var u=usuario_();
  if(simular){
    var d=datos_(maestro_(),String(periodoId)),r=generar_(d,u,String(carreraId));
    return {simulacion:true,agregadas:r.nuevas.length,omitidas:r.omitidas,advertencias:r.advertencias,propuestas:r.nuevas};
  }
  return conBloqueo_(function(){
    var m=maestro_(),d=datos_(m,String(periodoId)),r=generar_(d,u,String(carreraId));
    if(r.nuevas.length){
      sobrescribirTabla_(d.libro,'Asignaciones',d.Asignaciones);
      regenerarVistas_(d);
      registrar_(m,u.correo,'GENERAR',periodoId,carreraId,r.nuevas.length+' sesiones nuevas; '+r.advertencias.length+' advertencias');
    }
    return {simulacion:false,agregadas:r.nuevas.length,omitidas:r.omitidas,advertencias:r.advertencias,asignaciones:d.Asignaciones};
  });
}
