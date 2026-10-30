/** Control de calidad de catálogos y horarios sin realizar modificaciones. */
function apiDiagnostico(periodoId) {
  usuario_();
  var d=datos_(maestro_(),String(periodoId)),problemas=[];
  function err(tipo,id,detalle){problemas.push({tipo:tipo,id:id,detalle:detalle});}
  [
    ['Coordinaciones','coordinacion_id'],['Carreras','carrera_id'],['Areas','area_id'],
    ['Docentes','docente_id'],['Asignaturas','asignatura_id'],['Grupos','grupo_id'],
    ['Aulas','aula_id'],['Turnos','turno_id'],['Bloques','bloque_id'],
    ['Ofertas','oferta_id'],['Combinaciones','combinacion_id'],['Asignaciones','asignacion_id']
  ].forEach(function(item){
    var seen={};
    d[item[0]].forEach(function(row){
      var id=row[item[1]];
      if(!id)err(item[0],'<vacío>','Identificador obligatorio.');
      else if(seen[id])err(item[0],id,'Identificador duplicado.');
      seen[id]=true;
    });
  });
  d.Carreras.forEach(function(c){
    if(!uno_(d.Coordinaciones,'coordinacion_id',c.coordinacion_id))err('Carreras',c.carrera_id,'Coordinación desconocida: '+c.coordinacion_id);
  });
  d.Asignaturas.forEach(function(a){
    if(!uno_(d.Areas,'area_id',a.area_id))err('Asignaturas',a.asignatura_id,'Área desconocida: '+a.area_id);
  });
  d.Grupos.forEach(function(g){
    if(!uno_(d.Carreras,'carrera_id',g.carrera_id))err('Grupos',g.grupo_id,'Carrera no encontrada.');
    if(!uno_(d.Turnos,'turno_id',g.turno_id))err('Grupos',g.grupo_id,'Turno no encontrado.');
    if(Number(g.matricula)<1)err('Grupos',g.grupo_id,'Matrícula debe ser mayor que cero.');
  });
  d.Ofertas.filter(function(o){return o.periodo_id===periodoId;}).forEach(function(o){
    try{if(!o.combinacion_id)unidad_(d,[o.oferta_id]);}
    catch(e){err('Ofertas',o.oferta_id,e.message);}
  });
  d.Combinaciones.filter(function(c){return c.periodo_id===periodoId;}).forEach(function(c){
    if(!activo_(c.activa))return;
    try{unidad_(d,dividir_(c.oferta_ids));}
    catch(e){err('Combinaciones',c.combinacion_id,e.message);}
  });
  var superUser={rol:'ADMIN',carreras:[]};
  d.Asignaciones.forEach(function(a){
    try {
      validar_(d,superUser,{ofertaIds:dividir_(a.oferta_ids),dia:a.dia,bloqueIds:dividir_(a.bloque_ids),aulaId:a.aula_id,docenteId:a.docente_id},a.asignacion_id);
    } catch(e){err('Asignaciones',a.asignacion_id,e.message);}
  });
  return {total:problemas.length,problemas:problemas};
}
