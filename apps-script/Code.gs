/**
 * Schedule2 · UCC. Almacén Sheets, control de acceso, API y vistas.
 * Toda mutación pasa por permisos del servidor y bloqueo global.
 */
var TABLAS = {
  Coordinaciones:['coordinacion_id','nombre','activa'],
  Carreras:['carrera_id','nombre','coordinacion_id','activa'],
  Usuarios:['correo','nombre','rol','activo'],
  UsuarioCarreras:['correo','carrera_id','activo'],
  Areas:['area_id','nombre','activa'],
  Docentes:['docente_id','nombre','correo','activo'],
  DocenteAreas:['docente_id','area_id'],
  Asignaturas:['asignatura_id','nombre','area_id','nivel','compartible','activa'],
  Grupos:['grupo_id','carrera_id','nombre','nivel','turno_id','matricula','activo'],
  Aulas:['aula_id','nombre','tipo','ubicacion','capacidad','activa'],
  Turnos:['turno_id','nombre','entrada','salida','receso_inicio','receso_fin','almuerzo_inicio','almuerzo_fin','max_bloques_dia','activo'],
  Bloques:['bloque_id','turno_id','dia','inicio','fin','orden','activo'],
  Periodos:['periodo_id','nombre','archivo_id','estado','inicio','fin'],
  Ofertas:['oferta_id','periodo_id','carrera_id','grupo_id','asignatura_id','turno_id','sesiones_semana','bloques_sesion','docente_id','tipo_espacio','matricula','combinacion_id','activa'],
  Combinaciones:['combinacion_id','periodo_id','oferta_ids','activa'],
  Disponibilidad:['docente_id','dia','inicio','fin','disponible'],
  Auditoria:['fecha','correo','accion','periodo_id','registro_id','detalle']
};
var CAMPOS_ASIGNACION=['asignacion_id','periodo_id','oferta_ids','carrera_ids','grupo_ids','asignatura_id','turno_id','dia','bloque_ids','inicio','fin','aula_id','docente_id','estudiantes','combinacion_id','propietario','version','creado','actualizado'];
var DIAS=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('Schedule2 · Gestión académica');
}
/** Ejecutar manualmente la primera vez como propietario del proyecto. */
function inicializarSistema() {
  var props=PropertiesService.getScriptProperties();
  var id=props.getProperty('MASTER_ID');
  var ss=id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('Schedule2_CONFIG');
  if (!id) props.setProperty('MASTER_ID',ss.getId());
  Object.keys(TABLAS).forEach(function(n){ asegurarHoja_(ss,n,TABLAS[n]); });
  if (!leerTabla_(ss,'Turnos').length) {
    agregarObjetos_(ss,'Turnos',[
      {turno_id:'DIURNO',nombre:'Diurno',entrada:'07:00',salida:'18:00',receso_inicio:'',receso_fin:'',almuerzo_inicio:'12:00',almuerzo_fin:'13:00',max_bloques_dia:10,activo:'SI'},
      {turno_id:'SABATINO',nombre:'Sabatino',entrada:'07:00',salida:'18:00',receso_inicio:'',receso_fin:'',almuerzo_inicio:'12:50',almuerzo_fin:'13:30',max_bloques_dia:6,activo:'SI'},
      {turno_id:'DOMINICAL',nombre:'Dominical',entrada:'07:00',salida:'17:00',receso_inicio:'',receso_fin:'',almuerzo_inicio:'12:00',almuerzo_fin:'13:00',max_bloques_dia:6,activo:'SI'}
    ]);
  }
  if (!leerTabla_(ss,'Bloques').length) {
    var r=[];
    var sets=[
      ['DIURNO',DIAS.slice(0,5),[['08:00','08:50'],['08:55','09:45'],['09:50','10:40'],['10:45','11:35'],['13:00','13:50'],['13:55','14:45'],['14:50','15:40'],['15:45','16:35']]],
      ['SABATINO',['Sábado'],[['08:00','09:30'],['09:40','11:10'],['11:20','12:50'],['13:30','15:00'],['15:10','16:40']]],
      ['DOMINICAL',['Domingo'],[['08:00','09:20'],['09:30','10:50'],['11:00','12:00'],['13:00','14:20'],['14:30','15:50']]]
    ];
    sets.forEach(function(s){s[1].forEach(function(d){s[2].forEach(function(t,i){r.push({bloque_id:s[0]+'_'+d+'_'+(i+1),turno_id:s[0],dia:d,inicio:t[0],fin:t[1],orden:i+1,activo:'SI'});});});});
    agregarObjetos_(ss,'Bloques',r);
  }
  var correo=Session.getEffectiveUser().getEmail().toLowerCase().trim();
  if (!correo) throw new Error('No se pudo identificar al propietario.');
  if (!leerTabla_(ss,'Usuarios').some(function(u){return String(u.correo).toLowerCase()===correo;}))
    agregarObjetos_(ss,'Usuarios',[{correo:correo,nombre:'Administrador principal',rol:'ADMIN',activo:'SI'}]);
  SpreadsheetApp.flush();
  Logger.log('MAESTRO: '+ss.getUrl());
  return ss.getUrl();
}
/** Ejecutar desde el editor con una cuenta ADMIN autorizada. */
function crearPeriodo(periodoId,nombre,inicio,fin) {
  var u=usuario_();
  if (u.rol!=='ADMIN') throw new Error('Solo ADMIN puede crear períodos.');
  periodoId=String(periodoId||'').trim();
  if (!/^[0-9]{4}_[A-Za-z0-9_]+$/.test(periodoId)) throw new Error('Usar identificador como 2026_IIICuatrimestre');
  if ((inicio&&!/^\d{4}-\d{2}-\d{2}$/.test(inicio))||(fin&&!/^\d{4}-\d{2}-\d{2}$/.test(fin))||(inicio&&fin&&inicio>fin)) throw new Error('Fechas inválidas; use AAAA-MM-DD.');
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    var master=maestro_();
    if (leerTabla_(master,'Periodos').some(function(p){return p.periodo_id===periodoId;})) throw new Error('Ya existe el período');
    var libro=SpreadsheetApp.create(periodoId);
    asegurarHoja_(libro,'Asignaciones',CAMPOS_ASIGNACION);
    agregarObjetos_(master,'Periodos',[{periodo_id:periodoId,nombre:nombre||periodoId,archivo_id:libro.getId(),estado:'ABIERTO',inicio:inicio||'',fin:fin||''}]);
    registrar_(master,u.correo,'CREAR_PERIODO',periodoId,periodoId,libro.getId());
    return libro.getUrl();
  } finally {lock.releaseLock();}
}
function maestro_(){
  var id=PropertiesService.getScriptProperties().getProperty('MASTER_ID');
  if (!id) throw new Error('Primero ejecute inicializarSistema().');
  return SpreadsheetApp.openById(id);
}
function asegurarHoja_(ss,nombre,cabeceras) {
  var sh=ss.getSheetByName(nombre)||ss.insertSheet(nombre);
  if (sh.getLastRow()===0) {
    sh.getRange(1,1,1,cabeceras.length).setValues([cabeceras]);
    sh.setFrozenRows(1); sh.getRange(1,1,1,cabeceras.length).setBackground('#12315b').setFontColor('#ffffff').setFontWeight('bold');
    sh.autoResizeColumns(1,cabeceras.length);
  } else {
    var existentes=sh.getRange(1,1,1,cabeceras.length).getDisplayValues()[0];
    if (cabeceras.some(function(c,i){return existentes[i]!==c;})) throw new Error('Cabeceras modificadas en '+nombre+'. Restáurelas.');
  }
  return sh;
}
function leerTabla_(ss,nombre){
  var heads=nombre==='Asignaciones'?CAMPOS_ASIGNACION:TABLAS[nombre];
  var sh=asegurarHoja_(ss,nombre,heads);
  var n=sh.getLastRow();
  if (n<2) return [];
  return sh.getRange(2,1,n-1,heads.length).getDisplayValues().filter(function(v){return v.some(function(x){return String(x).trim();});}).map(function(row){
    var obj={};heads.forEach(function(h,i){obj[h]=row[i].trim();});return obj;
  });
}
function agregarObjetos_(ss,nombre,objetos) {
  if(!objetos.length)return;
  var heads=nombre==='Asignaciones'?CAMPOS_ASIGNACION:TABLAS[nombre];
  var sh=asegurarHoja_(ss,nombre,heads);
  var rows=objetos.map(function(o){return heads.map(function(h){return o[h]===undefined?'':String(o[h]);});});
  var range=sh.getRange(sh.getLastRow()+1,1,rows.length,heads.length);range.setNumberFormat('@');range.setValues(rows);
}
function sobrescribirTabla_(ss,nombre,objetos){
  var heads=nombre==='Asignaciones'?CAMPOS_ASIGNACION:TABLAS[nombre];
  var sh=asegurarHoja_(ss,nombre,heads);
  if (sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,heads.length).clearContent();
  agregarObjetos_(ss,nombre,objetos);
}
function activo_(v){return String(v||'').toUpperCase()==='SI';}
function usuario_(){
  var email=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
  if (!email) throw new Error('Identidad no disponible. Se requiere Google Workspace con correo verificado. Acceso denegado.');
  var master=maestro_(), usuario=leerTabla_(master,'Usuarios').find(function(x){return String(x.correo).toLowerCase()===email && activo_(x.activo);});
  if (!usuario) throw new Error('Correo no habilitado: '+email);
  usuario.correo=email;
  if (['ADMIN','COORDINADOR','LECTOR'].indexOf(usuario.rol)===-1) throw new Error('Rol inválido.');
  usuario.carreras=leerTabla_(master,'UsuarioCarreras').filter(function(x){return x.correo.toLowerCase()===email && activo_(x.activo);}).map(function(x){return x.carrera_id;});
  return usuario;
}
function puedeEditar_(u,carreras) {
  return u.rol==='ADMIN'||(u.rol==='COORDINADOR' && carreras.every(function(id){return u.carreras.indexOf(id)>=0;}));
}
function periodo_(master,id){
  var p=leerTabla_(master,'Periodos').find(function(x){return x.periodo_id===id;});
  if(!p||!p.archivo_id)throw new Error('Período inexistente o sin archivo.');
  return p;
}
function datos_(master,periodoId){
  var data={};
  Object.keys(TABLAS).filter(function(n){return n!=='Auditoria' && n!=='Usuarios' && n!=='UsuarioCarreras';}).forEach(function(n){data[n]=leerTabla_(master,n);});
  data.periodo=periodo_(master,periodoId);
  data.libro=SpreadsheetApp.openById(data.periodo.archivo_id);
  data.Asignaciones=leerTabla_(data.libro,'Asignaciones');
  return data;
}
function resumen_(u,data) {
  var result={usuario:{correo:u.correo,nombre:u.nombre,rol:u.rol,carreras:u.carreras},periodo:data.periodo};
  ['Coordinaciones','Carreras','Areas','Docentes','DocenteAreas','Asignaturas','Grupos','Aulas','Turnos','Bloques','Ofertas','Combinaciones','Disponibilidad','Asignaciones'].forEach(function(n){result[n]=data[n];});
  return result;
}
function apiInicio(){
  var u=usuario_(),m=maestro_(),ps=leerTabla_(m,'Periodos');
  var abiertos=ps.filter(function(p){return p.estado==='ABIERTO';});
  var selected=(abiertos[0]||ps[0]);
  return {usuario:{correo:u.correo,nombre:u.nombre,rol:u.rol,carreras:u.carreras},periodos:ps,adminUrl:u.rol==='ADMIN'?m.getUrl():'',datos:selected?resumen_(u,datos_(m,selected.periodo_id)):null};
}
function apiPeriodo(id) {
  var u=usuario_(),m=maestro_();return resumen_(u,datos_(m,String(id)));
}
function registrar_(master,correo,accion,periodoId,id,detalle) {
  agregarObjetos_(master,'Auditoria',[{fecha:new Date().toISOString(),correo:correo,accion:accion,periodo_id:periodoId,registro_id:id,detalle:detalle}]);
}
function limpiarNombreHoja_(carrera) {
  return String(carrera.nombre||carrera.carrera_id).replace(/[\\\/?*\[\]:]/g,' ').slice(0,78)+' ['+String(carrera.carrera_id).slice(0,12)+']';
}
/** Las hojas por carrera son vistas materializadas; Asignaciones es la única tabla editable por la API. */
function regenerarVistas_(d) {
  var shs=d.libro.getSheets();
  var carreras=d.Carreras.filter(function(c){return activo_(c.activa);});
  carreras.forEach(function(c){
    var name=limpiarNombreHoja_(c),sh=d.libro.getSheetByName(name)||d.libro.insertSheet(name);
    var headers=['Día','Inicio','Fin','Asignatura','Grupo(s)','Docente','Aula','Turno','Compartida','ID asignación'];
    if (sh.getLastRow()>0) sh.clearContents();
    sh.getRange(1,1,1,headers.length).setValues([headers]).setBackground('#12315b').setFontColor('#ffffff').setFontWeight('bold');
    sh.setFrozenRows(1);
    var filtered=d.Asignaciones.filter(function(a){return dividir_(a.carrera_ids).indexOf(c.carrera_id)>=0;})
      .sort(function(a,b){return DIAS.indexOf(a.dia)-DIAS.indexOf(b.dia)||minutos_(a.inicio)-minutos_(b.inicio);});
    if(filtered.length)sh.getRange(2,1,filtered.length,headers.length).setValues(filtered.map(function(a){
      return [a.dia,a.inicio,a.fin,nombre_(d.Asignaturas,'asignatura_id',a.asignatura_id),dividir_(a.grupo_ids).map(function(id){return nombre_(d.Grupos,'grupo_id',id);}).join(' / '),nombre_(d.Docentes,'docente_id',a.docente_id),nombre_(d.Aulas,'aula_id',a.aula_id),a.turno_id,a.combinacion_id?'SI':'NO',a.asignacion_id];
    }));
    sh.autoResizeColumns(1,Math.min(headers.length,8));
  });
}
function nombre_(list,key,id){var x=list.find(function(o){return o[key]===id;});return x?(x.nombre||id):id;}
function dividir_(v){return String(v||'').split('|').map(function(s){return s.trim();}).filter(Boolean);}
function minutos_(v){var a=/^(\d{2}):(\d{2})$/.exec(String(v));return a?Number(a[1])*60+Number(a[2]):NaN;}
