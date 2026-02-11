import { useEffect, useState } from "react";
import {
  fetchAdmins,
  deleteAdmin,
  type AdminUser,
} from "../services/adminService";
import { useAuth } from "../context/AuthContext";

export default function AdminManagement() {
  const { user } = useAuth();

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadAdmins() {
    try {
      setLoading(true);
      const data = await fetchAdmins();
      setAdmins(data);
    } catch (e: any) {
      setError("Failed to load admins");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdmins();
  }, []);

  async function handleDelete() {
    if (!selectedAdmin) return;

    try {
      setError(null);
      await deleteAdmin(selectedAdmin.id);

      setSuccessMessage("Admin deactivated successfully ✅");

      // refresh list
      await loadAdmins();

      // auto clear success after 2 sec
      setTimeout(() => {
        setShowDeleteModal(false);
        setSelectedAdmin(null);
        setSuccessMessage(null);
      }, 2000);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Delete failed");
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Admin Management</h2>

      {error && (
        <div className="bg-red-900/40 border border-red-700 px-4 py-2 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-slate-700 bg-slate-900">
        {loading ? (
          <div className="p-4 text-slate-400">Loading admins...</div>
        ) : admins.length === 0 ? (
          <div className="p-4 text-slate-400">No admins found.</div>
        ) : (
          <table className="w-full text-sm text-slate-200">
            <thead className="bg-slate-800 text-slate-300">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="border-t border-slate-800">
                  <td className="px-4 py-2">{admin.name}</td>
                  <td className="px-4 py-2">{admin.email}</td>
                  <td className="px-4 py-2 text-center">
                    <button
                      disabled={admin.id === user?.id}
                      onClick={() => {
                        setSelectedAdmin(admin);
                        setShowDeleteModal(true);
                      }}
                      className={`px-3 py-1 rounded text-xs font-semibold ${
                        admin.id === user?.id
                          ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                          : "bg-red-600 hover:bg-red-700 text-white"
                      }`}
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedAdmin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-lg p-5 w-full max-w-md">
            <h3 className="text-red-400 font-semibold text-lg">
              Confirm Deactivation
            </h3>

            <p className="text-sm text-slate-400 mt-2">
              Are you sure you want to deactivate:
            </p>

            <div className="mt-3 bg-red-900/20 p-3 rounded text-red-300 text-sm">
              <strong>{selectedAdmin.name}</strong> ({selectedAdmin.email})
            </div>

            {successMessage && (
              <div className="mt-3 bg-green-900/40 border border-green-700 px-3 py-2 rounded text-green-300 text-sm">
                {successMessage}
              </div>
            )}

            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedAdmin(null);
                }}
                className="px-3 py-1.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                onClick={handleDelete}
                className="px-4 py-1.5 rounded bg-red-700 hover:bg-red-800 text-white font-semibold"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
