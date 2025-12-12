import React, { useState, type FormEvent } from "react";
import { api } from "../services/api";
import { useSearchParams } from "react-router-dom";

// Re-use the same Section interface used in MarksEntry.tsx
export interface Section {
  id: number;
  section_name: string | null;
  roll_start: number;
  roll_end: number;
}

// Props for the component
interface CreateSectionFormProps {
  examId: number;
  onCreated: (section: Section) => void;
  onCancel?: () => void;
  isAdminView?: boolean;
}

const CreateSectionForm: React.FC<CreateSectionFormProps> = ({
  examId,
  onCreated,
  onCancel,
  isAdminView: isAdminViewProp,
}) => {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState<string>("");
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Use prop when provided; otherwise fall back to query param
  const isAdminView =
    typeof isAdminViewProp === "boolean"
      ? isAdminViewProp
      : searchParams.get("adminView") === "1";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Block admins from submitting even if they try (Enter key / programmatic)
    if (isAdminView) {
      setError("Admins cannot create sections.");
      return;
    }

    const rollStart = Number(start);
    const rollEnd = Number(end);

    if (!Number.isInteger(rollStart) || !Number.isInteger(rollEnd)) {
      setError("Roll start and end must be valid integers.");
      return;
    }
    if (rollStart > rollEnd) {
      setError("Roll start must be less than or equal to roll end.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        exam_id: examId,
        section_name: name || null,
        roll_start: rollStart,
        roll_end: rollEnd,
      };

      const res = await api.post("/exams/sections", payload);
      const created: Section = res.data as Section;
      onCreated(created);
      // clear form
      setName("");
      setStart("");
      setEnd("");
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          String(err?.message || "Failed to create section")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs text-slate-300 block">
          Section name (optional)
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. A or Batch 1"
          className="w-full mt-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-300 block">Roll start</label>
          <input
            value={start}
            onChange={(e) => setStart(e.target.value)}
            placeholder="101"
            type="number"
            className="w-full mt-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            min={0}
          />
        </div>

        <div>
          <label className="text-xs text-slate-300 block">Roll end</label>
          <input
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            placeholder="156"
            type="number"
            className="w-full mt-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            min={0}
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 rounded border border-slate-700 text-slate-200 hover:bg-slate-800"
            disabled={loading}
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          disabled={isAdminView || loading}
          title={isAdminView ? "Admins cannot create sections" : undefined}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white ${
            isAdminView || loading
              ? "bg-slate-700 cursor-not-allowed opacity-60"
              : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {loading ? "Creating…" : "Create Section"}
        </button>
      </div>
    </form>
  );
};

export default CreateSectionForm;
