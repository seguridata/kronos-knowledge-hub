import { type Kysely, sql } from 'kysely';

/**
 * La búsqueda por texto usaba solo la configuración 'english', que no entiende
 * la morfología del español (vacación/vacaciones, solicitar/solicitud...).
 * El tsvector ahora combina 'spanish' + 'english' (contenido bilingüe) y la
 * consulta usa la misma combinación (ver SearchService).
 */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION pages_tsvector_trigger() RETURNS trigger AS $$
    begin
        new.tsv :=
              setweight(to_tsvector('spanish', f_unaccent(coalesce(new.title, ''))), 'A') ||
              setweight(to_tsvector('english', f_unaccent(coalesce(new.title, ''))), 'A') ||
              setweight(to_tsvector('spanish', f_unaccent(substring(coalesce(new.text_content, ''), 1, 1000000))), 'B') ||
              setweight(to_tsvector('english', f_unaccent(substring(coalesce(new.text_content, ''), 1, 1000000))), 'B');
        return new;
    end;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  // Reconstruye el tsv de las páginas existentes con la nueva definición.
  await sql`
    UPDATE pages SET tsv =
          setweight(to_tsvector('spanish', f_unaccent(coalesce(title, ''))), 'A') ||
          setweight(to_tsvector('english', f_unaccent(coalesce(title, ''))), 'A') ||
          setweight(to_tsvector('spanish', f_unaccent(substring(coalesce(text_content, ''), 1, 1000000))), 'B') ||
          setweight(to_tsvector('english', f_unaccent(substring(coalesce(text_content, ''), 1, 1000000))), 'B')
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION pages_tsvector_trigger() RETURNS trigger AS $$
    begin
        new.tsv :=
                  setweight(to_tsvector('english', f_unaccent(coalesce(new.title, ''))), 'A') ||
                  setweight(to_tsvector('english', f_unaccent(substring(coalesce(new.text_content, ''), 1, 1000000))), 'B');
        return new;
    end;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`
    UPDATE pages SET tsv =
          setweight(to_tsvector('english', f_unaccent(coalesce(title, ''))), 'A') ||
          setweight(to_tsvector('english', f_unaccent(substring(coalesce(text_content, ''), 1, 1000000))), 'B')
  `.execute(db);
}
