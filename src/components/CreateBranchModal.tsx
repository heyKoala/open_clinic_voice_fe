import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './shadcn/dialog';
import { Building2, Plus, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from './shadcn/toast';

interface CreateBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateBranchModal({ isOpen, onClose }: CreateBranchModalProps) {
  const [name, setName] = useState('');
  const [clinicType, setClinicType] = useState('multi_doctor');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.add({ title: "Branch name is required", type: "error" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/clinics/', {
        name,
        clinic_type: clinicType,
        phone,
        address
      });
      
      const newClinic = response.data;
      toast.add({ title: "Branch created successfully!", type: "success" });
      
      // Automatically switch to the new clinic
      localStorage.setItem('active_clinic_id', newClinic.id);
      window.location.reload();
      
    } catch (error: any) {
      console.error("Failed to create branch", error);
      const data = error.response?.data;
      const fieldError = data && typeof data === 'object' ? Object.values(data).flat().find((v) => typeof v === 'string') : undefined;
      toast.add({ title: data?.detail || fieldError || "Failed to create branch", type: "error" });
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-cyan/10 mb-4">
            <Building2 className="h-6 w-6 text-brand-cyan" />
          </div>
          <DialogTitle className="text-center text-xl font-semibold">Add New Center</DialogTitle>
          <DialogDescription className="text-center">
            Create a new branch or center. You will automatically be switched to it after creation to set it up.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Center Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-brand-cyan focus:border-brand-cyan outline-none transition-all"
              placeholder="e.g. ManageOPD Downtown Branch"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Type</label>
            <select
              value={clinicType}
              onChange={(e) => setClinicType(e.target.value)}
              className="w-full border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-brand-cyan focus:border-brand-cyan outline-none transition-all"
            >
              <option value="multi_doctor">Multi-Doctor Clinic</option>
              <option value="single_doctor">Single Doctor Practice</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Phone (Optional)</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-brand-cyan focus:border-brand-cyan outline-none transition-all"
              placeholder="+91..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Address (Optional)</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="w-full border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-brand-cyan focus:border-brand-cyan outline-none transition-all"
              placeholder="Full address of the branch"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand-navy rounded-lg hover:bg-slate-800 transition-colors shadow-cyan-glow-hover flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Center
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
