/**
 * Pruebas automáticas puras: ejecutar ejecutarPruebas() desde Apps Script.
 * No acceden a archivos ni cambian datos reales.
 */
function ejecutarPruebas(){
  var d={
    periodo:{periodo_id:'2026_IIICuatrimestre',estado:'ABIERTO'},
    Carreras:[{carrera_id:'C1',nombre:'Sistemas',activa:'SI'},{carrera_id:'C2',nombre:'Derecho',activa:'SI'}],
    Grupos:[{grupo_id:'G1',carrera_id:'C1',nombre:'I-A',turno_id:'DIURNO',matricula:'25',activo:'SI'},{grupo_id:'G2',carrera_id:'C2',nombre:'I-B',turno_id:'DIURNO',matricula:'10',activo:'SI'}],
    Asignaturas:[{asignatura_id:'A1',nombre:'Historia de Nicaragua',area_id:'AR1',compartible:'SI',activa:'SI'}],
    Areas:[{area_id:'AR1',nombre:'Historia'}],
    Docentes:[{docente_id:'D1',nombre:'Profesor A',activo:'SI'},{docente_id:'D2',nombre:'Profesor B',activo:'SI'}],
    DocenteAreas:[{docente_id:'D1',area_id:'AR1'},{docente_id:'D2',area_id:'AR1'}],
    Turnos:[{turno_id:'DIURNO',entrada:'07:00',salida:'18:00',almuerzo_inicio:'12:00',almuerzo_fin:'13:00',receso_inicio:'',receso_fin:'',max_bloques_dia:'7',activo:'SI'}],
    Bloques:[{bloque_id:'B1',turno_id:'DIURNO',dia:'Lunes',inicio:'08:00',fin:'08:50',orden:'1',activo:'SI'},{bloque_id:'B2',turno_id:'DIURNO',dia:'Lunes',inicio:'08:55',fin:'09:45',orden:'2',activo:'SI'},{bloque_id:'B3',turno_id:'DIURNO',dia:'Lunes',inicio:'12:00',fin:'12:50',orden:'3',activo:'SI'}],
    Aulas:[{aula_id:'R1',nombre:'Aula 1',tipo:'AULA',capacidad:'50',activa:'SI'},{aula_id:'R2',nombre:'Aula 2',tipo:'AULA',capacidad:'30',activa:'SI'}],
    Ofertas:[{oferta_id:'O1',periodo_id:'2026_IIICuatrimestre',carrera_id:'C1',grupo_id:'G1',asignatura_id:'A1',turno_id:'DIURNO',sesiones_semana:'1',bloques_sesion:'1',docente_id:'',tipo_espacio:'AULA',matricula:'25',combinacion_id:'',activa:'SI'},{oferta_id:'O2',periodo_id:'2026_IIICuatrimestre',carrera_id:'C2',grupo_id:'G2',asignatura_id:'A1',turno_id:'DIURNO',sesiones_semana:'1',bloques_sesion:'1',docente_id:'',tipo_espacio:'AULA',matricula:'10',combinacion_id:'',activa:'SI'}],
    Combinaciones:[],Disponibilidad:[],Asignaciones:[]
  };
  var own={correo:'coord@example.edu',rol:'COORDINADOR',carreras:['C1']},admin={correo:'admin@example.edu',rol:'ADMIN',carreras:[]};
  var tests=[];
  function ok(name,fn){try{fn();tests.push('OK '+name);}catch(e){throw new Error('FALLÓ '+name+': '+e.message);}}
  function throws(name,fn){try{fn();throw new Error('No bloqueó el error esperado');}catch(e){if(e.message==='No bloqueó el error esperado')throw new Error('FALLÓ '+name);tests.push('OK '+name);}}
  var input={ofertaIds:['O1'],dia:'Lunes',bloqueIds:['B1'],aulaId:'R1',docenteId:'D1'};
  ok('Asignación válida',function(){validar_(d,own,input,'');});
  throws('Sin permiso sobre otra carrera',function(){validar_(d,own,{ofertaIds:['O2'],dia:'Lunes',bloqueIds:['B1'],aulaId:'R1',docenteId:'D1'},'');});
  throws('Capacidad estricta',function(){
    var old=d.Aulas[0].capacidad;d.Aulas[0].capacidad='20';
    try{validar_(d,own,input,'');}finally{d.Aulas[0].capacidad=old;}
  });
  throws('Bloque dentro de almuerzo',function(){validar_(d,own,{ofertaIds:['O1'],dia:'Lunes',bloqueIds:['B3'],aulaId:'R1',docenteId:'D1'},'');});
  d.Asignaciones=[{asignacion_id:'ANT',dia:'Lunes',inicio:'08:00',fin:'08:50',aula_id:'R1',docente_id:'D2',grupo_ids:'G2',oferta_ids:'O2',bloque_ids:'B1'}];
  throws('Choque global de aula',function(){validar_(d,own,input,'');});
  d.Asignaciones[0].aula_id='R2';d.Asignaciones[0].docente_id='D1';
  throws('Choque global de docente',function(){validar_(d,own,input,'');});
  d.Asignaciones[0].docente_id='D2';
  ok('Clases simultáneas con recursos independientes',function(){validar_(d,own,input,'');});
  d.Asignaciones=[];
  d.Disponibilidad=[{docente_id:'D1',dia:'Lunes',inicio:'08:00',fin:'09:00',disponible:'NO'}];
  throws('Indisponibilidad del docente',function(){validar_(d,own,input,'');});
  d.Disponibilidad=[];
  d.Ofertas[0].combinacion_id='COM';d.Ofertas[1].combinacion_id='COM';
  d.Combinaciones=[{combinacion_id:'COM',periodo_id:d.periodo.periodo_id,oferta_ids:'O1|O2',activa:'SI'}];
  throws('La combinación debe incluir todas las ofertas',function(){unidad_(d,['O1']);});
  ok('Combinación aprobada con capacidad total 35',function(){var u=unidad_(d,['O1','O2']);exigir_(u.matricula===35,'Cupo calculado incorrectamente');});
  throws('Combinación entre coordinaciones sin permiso',function(){validar_(d,own,{ofertaIds:['O1','O2'],dia:'Lunes',bloqueIds:['B1'],aulaId:'R1',docenteId:'D1'},'');});
  ok('ADMIN puede operar combinación aprobada',function(){validar_(d,admin,{ofertaIds:['O1','O2'],dia:'Lunes',bloqueIds:['B1'],aulaId:'R1',docenteId:'D1'},'');});
  Logger.log(tests.join('\n'));
  return {total:tests.length,pruebas:tests};
}
