import { sql } from './db';

/** The trigger records every policy change in the same transaction as the mutation. */
export async function ensurePolicyAudit() {
  await sql()`create table if not exists policy_audit (
    id bigint generated always as identity primary key, login text not null, actor text not null,
    operation text not null, before_policy jsonb, after_policy jsonb, at timestamptz not null default now()
  )`;
  await sql()`create or replace function record_policy_audit() returns trigger language plpgsql as $$
    begin
      if TG_OP = 'DELETE' then
        insert into policy_audit (login, actor, operation, before_policy, after_policy)
        values (OLD.login, coalesce(nullif(current_setting('app.audit_actor', true), ''), OLD.updated_by), TG_OP, to_jsonb(OLD), null);
        return OLD;
      else
        insert into policy_audit (login, actor, operation, before_policy, after_policy)
        values (NEW.login, NEW.updated_by, TG_OP, case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end, to_jsonb(NEW));
        return NEW;
      end if;
    end;
  $$`;
  await sql()`do $$ begin
    create trigger user_controls_audit after insert or update or delete on user_controls for each row execute function record_policy_audit();
  exception when duplicate_object then null; end $$`;
}
