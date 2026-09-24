import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Expense } from "../types";

/** Gastos de un rango de fechas (YYYY-MM-DD, ambos incluidos). Solo Gerencia. */
export function useExpenses(desde: string, hasta: string) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("expenses")
      .select("*")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setExpenses((data as Expense[]) ?? []);
    }
    setLoading(false);
  }, [desde, hasta]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { expenses, loading, error, reload };
}

export interface ExpenseInput {
  fecha: string;
  concepto: string;
  categoria: string;
  monto: number;
  metodo_pago: string | null;
  proveedor: string | null;
  notas: string | null;
  photo_paths: string[];
}

export async function createExpense(input: ExpenseInput) {
  const { error } = await supabase.from("expenses").insert(input);
  return { error: error?.message ?? null };
}

export async function deleteExpense(expense: Expense) {
  const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
  if (!error && expense.photo_paths.length > 0) {
    await supabase.storage.from("gastos").remove(expense.photo_paths);
  }
  return { error: error?.message ?? null };
}
