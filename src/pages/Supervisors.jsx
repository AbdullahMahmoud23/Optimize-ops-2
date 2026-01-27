import { useState } from "react";

function Supervisors() {
  // === STATE ===
  const [supervisors, setSupervisors] = useState([
    {
      id: 1,
      name: "Ahmed Mohamed",
      email: "ahmed@company.com",
      status: "active",
      createdAt: "2024-10-15",
    },
    {
      id: 2,
      name: "Sara Ali",
      email: "sara@company.com",
      status: "active",
      createdAt: "2024-10-20",
    },
    {
      id: 3,
      name: "Mohamed Hassan",
      email: "mohamed@company.com",
      status: "inactive",
      createdAt: "2024-09-10",
    },
    {
      id: 4,
      name: "Fatima Ahmed",
      email: "fatima@company.com",
      status: "active",
      createdAt: "2024-11-01",
    },
    {
      id: 5,
      name: "Ali Omar",
      email: "ali@company.com",
      status: "active",
      createdAt: "2024-10-25",
    },
    {
      id: 6,
      name: "Nour Hassan",
      email: "nour@company.com",
      status: "inactive",
      createdAt: "2024-09-15",
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedToDelete, setSelectedToDelete] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    status: "active",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");

  // === HANDLERS ===
  const openAddModal = () => {
    setFormData({ name: "", email: "", password: "", status: "active" });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (supervisor) => {
    setFormData({
      name: supervisor.name,
      email: supervisor.email,
      password: "",
      status: supervisor.status,
    });
    setEditingId(supervisor.id);
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
      // update existing
      setSupervisors((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, ...formData } : s))
      );
    } else {
      // add new
      const newSupervisor = {
        id: supervisors.length + 1,
        name: formData.name,
        email: formData.email,
        status: formData.status,
        createdAt: new Date().toISOString().split("T")[0],
      };
      setSupervisors([...supervisors, newSupervisor]);
    }
    setIsModalOpen(false);
  };

  const confirmDelete = (supervisor) => {
    setSelectedToDelete(supervisor);
    setIsDeleteConfirmOpen(true);
  };

  const handleDelete = () => {
    setSupervisors(supervisors.filter((s) => s.id !== selectedToDelete.id));
    setIsDeleteConfirmOpen(false);
  };

  // === FILTERED SUPERVISORS ===
  const filteredSupervisors = supervisors
    .filter(
      (s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((s) =>
      statusFilter === "All Status"
        ? true
        : s.status === statusFilter.toLowerCase()
    );

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold">Managers Management</h1>
          <p className="text-base-content/60 mt-2">
            Manage manager accounts
          </p>
        </div>
        <button className="btn btn-primary gap-2" onClick={openAddModal}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          Add New Manager
        </button>
      </div>

      {/* Search & Filter */}
      <div className="card bg-base-200 shadow-xl mb-6">
        <div className="card-body flex flex-wrap gap-4">
          <div className="form-control flex-1 min-w-[200px]">
            <label className="label">
              <span className="label-text">Search</span>
            </label>
            <input
              type="text"
              placeholder="Search by name or email..."
              className="input input-bordered w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Status</span>
            </label>
            <select
              className="select select-bordered"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>All Status</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4 text-base-content/60">
        Showing{" "}
        <span className="font-bold text-base-content">
          {filteredSupervisors.length}
        </span>{" "}
        managers
      </div>

      {/* Table */}
      <div className="card bg-base-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead className="bg-base-200">
              <tr>
                <th></th>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Date Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSupervisors.map((supervisor) => (
                <tr key={supervisor.id} className="hover">
                  <td>
                    <input type="checkbox" className="checkbox" />
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="avatar placeholder">
                        <div className="bg-primary text-primary-content w-12 rounded-full">
                          <span className="text-lg">
                            {supervisor.name.charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="font-bold">{supervisor.name}</div>
                        <div className="text-sm opacity-50">
                          ID: {supervisor.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{supervisor.email}</td>
                  <td>
                    {supervisor.status === "active" ? (
                      <div className="badge badge-success gap-2">Active</div>
                    ) : (
                      <div className="badge badge-error gap-2">Inactive</div>
                    )}
                  </td>
                  <td>{supervisor.createdAt}</td>
                  <td>
                    <div className="dropdown dropdown-end">
                      <label tabIndex={0} className="btn btn-ghost btn-sm">
                        ⋮
                      </label>
                      <ul
                        tabIndex={0}
                        className="dropdown-content menu bg-base-200 rounded-box w-52 p-2 shadow"
                      >
                        <li>
                          <a onClick={() => openEditModal(supervisor)}>Edit</a>
                        </li>
                        <li>
                          <a
                            onClick={() => confirmDelete(supervisor)}
                            className="text-error"
                          >
                            Delete
                          </a>
                        </li>
                      </ul>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD/EDIT MODAL */}
      {isModalOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-md">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => setIsModalOpen(false)}
            >
              ✕
            </button>
            <h3 className="font-bold text-lg mb-4">
              {editingId ? "Edit Manager" : "Add New Manager"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Full Name</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Email</span>
                </label>
                <input
                  type="email"
                  className="input input-bordered w-full"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
              </div>
              {!editingId && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Password</span>
                  </label>
                  <input
                    type="password"
                    className="input input-bordered w-full"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                  />
                </div>
              )}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Status</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? "Save Changes" : "Add Manager"}
                </button>
              </div>
            </form>
          </div>
        </dialog>
      )}

      {/* DELETE CONFIRM MODAL */}
      {isDeleteConfirmOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4 text-error">
              Confirm Delete
            </h3>
            <p>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{selectedToDelete.name}</span>?
            </p>
            <div className="modal-action">
              <button
                className="btn"
                onClick={() => setIsDeleteConfirmOpen(false)}
              >
                Cancel
              </button>
              <button className="btn btn-error" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}

export default Supervisors;
