"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Branch { id: string; name: string }
interface Device { id: string; branchId: string; name: string; activatedAt: string | null; revokedAt: string | null; expiresAt: string; activationExpiresAt: string }
interface Operator { id: string; name: string; role: string; branchId: string | null }
interface KioskData { admin: boolean; branches: Branch[]; devices: Device[]; users: Operator[]; grants: { userId: string; branchId: string }[] }

export function KiosksClient() {
  const [data, setData] = useState<KioskData | null>(null);
  const [error, setError] = useState("");
  const [branchId, setBranchId] = useState("");
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/kiosks", { cache: "no-store" });
      if (!response.ok) throw new Error("No tienes acceso o no se pudieron cargar los kioscos.");
      const next: KioskData = await response.json(); setData(next); setError("");
      setBranchId(current => current || next.branches[0]?.id || "");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudieron cargar los kioscos"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function action(body: object) {
    setBusy(true);
    try {
      const response = await fetch("/api/kiosks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo guardar");
      if (result.activationCode) { setCode(result.activationCode); setName(""); }
      toast.success("Cambio guardado"); await load();
    } catch (failure) { toast.error(failure instanceof Error ? failure.message : "No se pudo guardar"); }
    finally { setBusy(false); }
  }
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Cargando kioscos…</p>;
  return <div className="max-w-5xl space-y-8">
    <header><h1 className="text-2xl font-semibold">Kioscos por sucursal</h1><p className="mt-2 text-muted-foreground">Activa dispositivos sin compartir cuentas administrativas. Cada kiosco queda limitado a una sucursal.</p><Link href="/kiosk" className="mt-3 inline-block underline">Abrir pantalla de activación</Link></header>
    {!data.branches.length ? <p>No tienes sucursales autorizadas. Solicita el permiso «Gestionar kioscos» a tu administrador.</p> : <>
      <form onSubmit={e => { e.preventDefault(); void action({ action: "create", branchId, name }); }} className="grid gap-4 rounded-lg border bg-background p-5 sm:grid-cols-2">
        <label className="space-y-2"><span>Sucursal</span><select value={branchId} onChange={e => setBranchId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3">{data.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="space-y-2"><span>Nombre del dispositivo</span><Input value={name} onChange={e => setName(e.target.value)} maxLength={80} required placeholder="Recepción" /></label>
        <Button type="submit" disabled={busy || !branchId}>Crear código de activación</Button>
      </form>
      {code && <section aria-live="polite" className="rounded-lg border p-5 space-y-3"><h2 className="font-semibold">Código de un solo uso</h2><p className="text-sm text-muted-foreground">Introduce este código en el dispositivo antes de 15 minutos. Se muestra únicamente ahora; no lo compartas fuera de tu equipo.</p><code className="block break-all select-all">{code}</code><Button variant="outline" onClick={() => setCode("")}>Ocultar código</Button></section>}
      <section className="space-y-3"><h2 className="text-lg font-semibold">Dispositivos</h2>{!data.devices.length && <p className="text-muted-foreground">Todavía no hay dispositivos. Crea un código para activar el primero.</p>}
        <ul className="divide-y rounded-lg border">{data.devices.map(d => <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{d.name}</p><p className="text-sm text-muted-foreground">{data.branches.find(b => b.id === d.branchId)?.name} — {d.revokedAt ? "Revocado" : new Date(d.expiresAt) <= new Date() ? "Vencido" : d.activatedAt ? "Activo" : new Date(d.activationExpiresAt) <= new Date() ? "Código vencido" : "Pendiente de activación"}</p></div><Button variant="outline" disabled={busy || Boolean(d.revokedAt)} onClick={() => { if (window.confirm("¿Revocar este kiosco? El dispositivo dejará de poder registrar asistencia.")) void action({ action: "revoke", deviceId: d.id }); }}>Revocar</Button></li>)}</ul>
      </section>
      {data.admin && <section className="space-y-4"><h2 className="text-lg font-semibold">Delegar «Gestionar kioscos»</h2><p className="text-sm text-muted-foreground">Este permiso no cambia el rol ni habilita otras funciones administrativas.</p><form onSubmit={e => { e.preventDefault(); void action({ action: "grant", branchId, userId }); }} className="flex flex-wrap items-end gap-3">
        <label className="space-y-2"><span className="block">Usuario</span><select value={userId} onChange={e => setUserId(e.target.value)} required className="h-10 rounded-md border bg-background px-3"><option value="">Seleccionar usuario</option>{data.users.filter(u => u.role !== "BRANCH_SUPERVISOR" || u.branchId === branchId).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
        <p className="pb-2 text-sm">Sucursal: {data.branches.find(b => b.id === branchId)?.name}</p><Button type="submit" disabled={busy || !userId || !branchId}>Conceder permiso</Button>
      </form><ul className="divide-y">{data.grants.map(g => <li key={`${g.userId}:${g.branchId}`} className="flex flex-wrap items-center justify-between gap-3 py-3"><span>{data.users.find(u => u.id === g.userId)?.name ?? "Usuario"} — {data.branches.find(b => b.id === g.branchId)?.name ?? "Sucursal"}</span><Button variant="outline" disabled={busy} onClick={() => void action({ action: "revoke-grant", ...g })}>Retirar permiso</Button></li>)}</ul></section>}
    </>}
  </div>;
}
