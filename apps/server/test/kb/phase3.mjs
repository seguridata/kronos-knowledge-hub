// Fase 3: indexado, búsqueda en español, híbrida, permisos, incrementalidad y evaluación.
// NOTA: con AI_DRIVER=test los embeddings son léxicos (sin semántica real): esto valida
// el PIPELINE, la fusión y la seguridad; la calidad semántica real exige un modelo externo
// (ver `evaluate.mjs`).

export async function phase3({ http, callTool, unwrap, cookie, sql, check, ids }) {
  const { pub, priv, pVac, memberId } = ids;
  console.log('\nH. fase 3: búsqueda en español, indexado e híbrida');

  const mk = async (spaceId, title, content) =>
    unwrap(await http('/api/pages/create', { cookie, body: { spaceId, title, content, format: 'markdown' } }));

  const corpus = [
    ['Plan de capacitación anual', 'La capacitación obligatoria de seguridad de la información se realiza cada año en marzo.'],
    ['Reembolso de viáticos', 'Los gastos de viaje se reembolsan en 5 días hábiles presentando facturas.'],
    ['Guía de teletrabajo', 'El teletrabajo se permite dos días por semana con autorización del jefe directo.'],
    ['Respuesta a incidentes', 'Ante un incidente de seguridad, notificar al equipo de respuesta en menos de una hora.'],
    ['Alta de nuevos empleados', 'El proceso de incorporación incluye entrega de equipo, accesos y firma de contrato.'],
    ['Política de contraseñas', 'Las contraseñas deben tener doce caracteres y rotarse cada noventa días.'],
    ['Respaldo de bases de datos', 'Los respaldos de la base de datos se ejecutan cada noche a las 2 AM y se retienen 30 días.'],
    ['Uso de VPN', 'Para acceder a la red interna desde fuera de la oficina se debe usar la VPN corporativa.'],
    ['Código de conducta', 'Todos los colaboradores deben actuar con integridad y reportar conflictos de interés.'],
  ];
  const created = {};
  for (const [t, c] of corpus) created[t] = await mk(pub.id, t, `# ${t}\n\n${c}`);
  const pPriv2 = await mk(priv.id, 'Plan de reestructura 2027', '# Reestructura\n\nSe planea reducir la plantilla en el área comercial el próximo trimestre. Confidencial.');
  check('seed corpus fase 3', Object.values(created).every((p) => p?.id) && !!pPriv2?.id);

  const ownerKey = unwrap(await http('/api/api-keys/create', { cookie, body: { name: 'kbtest p3 owner', scope: 'read', expiresInDays: 7 } })).key;
  const mk3 = unwrap(await http('/api/api-keys/create', { cookie, body: { name: 'kbtest p3 member', scope: 'read', expiresInDays: 7 } }));
  sql(`update api_keys set creator_id='${memberId}' where id='${mk3.id}'`);
  const memberKey = mk3.key;

  // ---- estado e indexado
  const st0 = unwrap(await http('/api/knowledge/status', { cookie, body: {} }));
  check('embeddings habilitados', st0.enabled === true && st0.tableExists === true, JSON.stringify(st0));
  check('hay páginas pendientes antes de indexar', st0.pending > 0, JSON.stringify(st0));
  check('API key no puede operar el índice (403)', (await http('/api/knowledge/status', { key: ownerKey, body: {} })).status === 403);
  const t0 = Date.now();
  const st1 = unwrap(await http('/api/knowledge/reindex', { cookie, body: { full: true, wait: true } }));
  check('reindex completo → 0 pendientes', st1.pending === 0, JSON.stringify(st1));
  const empty = Number(sql(`select count(*) from pages where deleted_at is null and btrim(coalesce(title,''))='' and btrim(coalesce(text_content,''))=''`));
  check('indexó todas las páginas con contenido', st1.indexedPages === st1.pages - empty, JSON.stringify(st1));
  check('al menos un chunk por página', st1.chunks >= st1.indexedPages && st1.chunks > 0);
  console.log(`      (reindex: ${Date.now() - t0} ms, ${st1.indexedPages} páginas, ${st1.chunks} chunks)`);
  const dims = sql(`select distinct vector_dims(embedding) from page_embeddings`);
  check('vectores de 1536 dims', dims === '1536', dims);

  const search = async (key, query, mode, extra = {}) => {
    const r = await http('/api/search', { key, body: { query, mode, ...extra } });
    const body = unwrap(r);
    return { status: r.status, items: body?.items ?? [], mode: body?.mode };
  };
  const titles = (r) => r.items.map((i) => i.title);

  // ---- español (modo texto)
  const m1 = await search(ownerKey, 'vacación', 'keyword');
  check('stemming español: "vacación" encuentra "vacaciones"', titles(m1).includes('Política de vacaciones'), JSON.stringify(titles(m1)));
  const m2 = await search(ownerKey, 'politica contrasenas', 'keyword');
  check('sin acentos: "politica contrasenas" encuentra "Política de contraseñas"', titles(m2).includes('Política de contraseñas'), JSON.stringify(titles(m2)));
  check('consulta sin coincidencias no rompe', (await search(ownerKey, 'backup nightly', 'keyword')).status === 200);

  // ---- híbrida (un typo: el tsvector no lo entiende, la capa de vectores sí)
  const h1 = await search(ownerKey, 'capacitasion', 'hybrid');
  check('modo hybrid activo', h1.mode === 'hybrid', h1.mode);
  const k1 = await search(ownerKey, 'capacitasion', 'keyword');
  check('keyword NO encuentra "capacitación" con el typo "capacitasion"', !titles(k1).includes('Plan de capacitación anual'), JSON.stringify(titles(k1)));
  const hit = h1.items.find((i) => i.title === 'Plan de capacitación anual');
  check('hybrid SÍ lo encuentra (aporte de los vectores)', !!hit, JSON.stringify(titles(h1)));
  check('marca matchedBy semantic', !!hit && hit.matchedBy.includes('semantic'), JSON.stringify(hit?.matchedBy));
  check('el snippet sale del fragmento', !!hit?.highlight && /capacitaci/i.test(hit.highlight), hit?.highlight);
  const h2 = await search(ownerKey, 'vacaciones empleados', 'hybrid');
  const both = h2.items.find((i) => i.title === 'Política de vacaciones');
  check('coincidencia en ambos rankings suma (matchedBy keyword+semantic)', !!both && both.matchedBy.length === 2, JSON.stringify(both?.matchedBy));
  check('resultados ordenados por score', h2.items.every((it, i) => i === 0 || h2.items[i - 1].score >= it.score));
  check('respeta limit', (await search(ownerKey, 'seguridad', 'hybrid', { limit: 2 })).items.length <= 2);

  // ---- permisos en híbrida
  console.log('   permisos (híbrida)');
  const op = await search(ownerKey, 'reestructura plantilla', 'hybrid');
  check('owner encuentra página del espacio privado', titles(op).includes('Plan de reestructura 2027'), JSON.stringify(titles(op)));
  for (const q of ['reestructura plantilla', 'salario director', 'nómina', 'confidencial reducir']) {
    const r = await search(memberKey, q, 'hybrid');
    const leaked = titles(r).filter((t) => /Nómina|reestructura/i.test(t));
    check(`miembro NO ve privadas con "${q}"`, leaked.length === 0, JSON.stringify(titles(r)));
  }
  const ms = await search(memberKey, 'reestructura', 'hybrid', { spaceId: priv.id });
  check('miembro con spaceId privado explícito → nada', ms.items.length === 0, JSON.stringify(titles(ms)));
  const mm = await callTool(memberKey, 'search_pages', { query: 'reestructura plantilla comercial' });
  check('MCP miembro: sin filtración', !(mm.data?.results ?? []).some((r) => /reestructura/i.test(r.title)), JSON.stringify(mm.data));
  const mo = await callTool(ownerKey, 'search_pages', { query: 'capacitasion' });
  check('MCP usa híbrida', mo.data?.mode === 'hybrid' && mo.data.results.some((r) => r.title === 'Plan de capacitación anual'), JSON.stringify(mo.data)?.slice(0, 200));

  // página movida de espacio: el filtro usa el espacio ACTUAL, no el denormalizado
  sql(`update pages set space_id='${priv.id}' where id='${pVac.id}'`);
  const moved = await search(memberKey, 'vacaciones empleados días hábiles', 'hybrid');
  check('página movida a espacio privado deja de verse (aunque el embedding conserve el espacio viejo)', !titles(moved).includes('Política de vacaciones'), JSON.stringify(titles(moved)));
  const movedOwner = await search(ownerKey, 'vacaciones empleados días hábiles', 'hybrid');
  check('owner sí la sigue viendo', titles(movedOwner).includes('Política de vacaciones'));
  sql(`update pages set space_id='${pub.id}' where id='${pVac.id}'`);

  // ---- incrementalidad
  console.log('   indexado incremental');
  const newTerm = 'criptomonedas';
  const probe0 = await search(ownerKey, newTerm, 'hybrid');
  check('término nuevo no existe todavía', probe0.items.length === 0, JSON.stringify(titles(probe0)));
  sql(`update pages set text_content = text_content || ' Está prohibido minar ${newTerm} en equipos de la empresa.' where id='${created['Uso de VPN'].id}'`);
  const stA = unwrap(await http('/api/knowledge/status', { cookie, body: {} }));
  check('página editada aparece como pendiente', stA.pending === 1, JSON.stringify(stA));
  const keepBefore = sql(`select string_agg(id::text, ',' order by id) from page_embeddings where page_id='${created['Código de conducta'].id}'`);
  const stB = unwrap(await http('/api/knowledge/reindex', { cookie, body: { wait: true } }));
  check('reindex incremental deja 0 pendientes', stB.pending === 0, JSON.stringify(stB));
  const probe1 = await search(ownerKey, newTerm, 'hybrid');
  check('el cambio ya es buscable', titles(probe1).includes('Uso de VPN'), JSON.stringify(titles(probe1)));
  const keepAfter = sql(`select string_agg(id::text, ',' order by id) from page_embeddings where page_id='${created['Código de conducta'].id}'`);
  check('páginas sin cambios NO se re-embeben (mismos ids de vector)', !!keepBefore && keepBefore === keepAfter);

  // borrado
  const delId = created['Respaldo de bases de datos'].id;
  sql(`update pages set deleted_at=now() where id='${delId}'`);
  await http('/api/knowledge/reindex', { cookie, body: { wait: true } });
  check('reindex limpia embeddings de páginas borradas', sql(`select count(*) from page_embeddings where page_id='${delId}'`) === '0');
  const del = await search(ownerKey, 'respaldo nocturno base de datos', 'hybrid');
  check('página borrada no aparece', !titles(del).includes('Respaldo de bases de datos'), JSON.stringify(titles(del)));
  sql(`update pages set deleted_at=null where id='${delId}'`);
  await http('/api/knowledge/reindex', { cookie, body: { wait: true } });

  // ---- evaluación: hit@3 keyword vs hybrid
  console.log('   evaluación (10 preguntas en lenguaje natural)');
  const evalSet = [
    ['cuántos días de vacación me tocan', 'Política de vacaciones'],
    ['capacitasion obligatoria de seguridad', 'Plan de capacitación anual'],
    ['reembolsar gastos de viaje', 'Reembolso de viáticos'],
    ['trabajar remoto teletrabajo', 'Guía de teletrabajo'],
    ['incidente de seguridad notificar', 'Respuesta a incidentes'],
    ['incorporación de empleados nuevos', 'Alta de nuevos empleados'],
    ['contraseña caracteres rotar', 'Política de contraseñas'],
    ['respaldo nocturno base de datos', 'Respaldo de bases de datos'],
    ['acceso remoto VPN red interna', 'Uso de VPN'],
    ['conflicto de interés integridad', 'Código de conducta'],
  ];
  let kwHits = 0, hyHits = 0;
  const lat = [];
  for (const [q, want] of evalSet) {
    const kw = await search(ownerKey, q, 'keyword', { limit: 3 });
    const t = Date.now();
    const hy = await search(ownerKey, q, 'hybrid', { limit: 3 });
    lat.push(Date.now() - t);
    const kHit = titles(kw).slice(0, 3).includes(want);
    const hHit = titles(hy).slice(0, 3).includes(want);
    kwHits += kHit ? 1 : 0; hyHits += hHit ? 1 : 0;
    if (!hHit) console.log(`      miss hybrid: "${q}" → ${JSON.stringify(titles(hy))}`);
  }
  lat.sort((a, b) => a - b);
  console.log(`      hit@3 keyword=${kwHits}/10 hybrid=${hyHits}/10 | latencia hybrid p50=${lat[5]}ms max=${lat[9]}ms`);
  check('hybrid hit@3 ≥ keyword', hyHits >= kwHits, `${hyHits} vs ${kwHits}`);
  check('hybrid hit@3 ≥ 90%', hyHits >= 9, `${hyHits}/10`);
  check('latencia hybrid razonable (max < 1500 ms)', lat[9] < 1500, `${lat[9]} ms`);
}
