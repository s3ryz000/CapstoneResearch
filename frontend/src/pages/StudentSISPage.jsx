import React from 'react';
import { studentApi } from '../lib/api/studentApi';
import { staffToast } from '../lib/notifications';

const CITIZENSHIP_OPTIONS = [
  'Filipino','American','Canadian','Japanese','Korean','Chinese','Australian',
  'British','Singaporean','Malaysian','Indian','German','French','Italian',
  'Spanish','Indonesian','Thai','Vietnamese','Other',
];

const StudentSISPage = () => {
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState(null);
  const [file, setFile] = React.useState(null);

  const student = profile?.student;

  const [form, setForm] = React.useState({
    contact_number: '',
    address: '',
    place_of_birth: '',
    sex: '',
    guardian_name: '',
    citizenship: '',
    elementary_school: '',
    elementary_year: '',
    high_school: '',
    high_school_year: '',
    previous_school: '',
    previous_course: '',
  });

  React.useEffect(() => {
    setLoading(true);
    studentApi.getProfile()
      .then((data) => {
        setProfile(data);
        const s = data?.student || {};
        setForm((prev) => ({
          ...prev,
          contact_number: s.contact_number || '',
          address: s.address || '',
          place_of_birth: s.place_of_birth || '',
          sex: s.sex === 'Male' || s.sex === 'male' ? 'M'
             : s.sex === 'Female' || s.sex === 'female' ? 'F'
             : (s.sex || ''),
          guardian_name: s.guardian_name || '',
          citizenship: s.citizenship || '',
          elementary_school: s.elementary_school || '',
          elementary_year: s.elementary_year ?? '',
          high_school: s.high_school || '',
          high_school_year: s.high_school_year ?? '',
          previous_school: s.previous_school || '',
          previous_course: s.previous_course || '',
        }));
      })
      .catch(() => {
        setError('Failed to load student profile.');
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus(null);
    try {
      let payload;
      
      if (file) {
        payload = new FormData();
        Object.entries(form).forEach(([key, val]) => {
          if (key === 'elementary_year' || key === 'high_school_year') {
            payload.append(key, val === '' ? '' : Number(val));
          } else {
            payload.append(key, val);
          }
        });
        payload.append('supporting_document', file);
      } else {
        payload = {
          ...form,
          elementary_year: form.elementary_year === '' ? null : Number(form.elementary_year),
          high_school_year: form.high_school_year === '' ? null : Number(form.high_school_year),
        };
      }

      const res = await studentApi.updateSIS(payload);
      
      if (res?.message === 'No changes detected.') {
        setSaveStatus({ type: 'info', message: 'No changes detected.' });
      } else {
        setSaveStatus({ 
          type: 'success', 
          message: res?.message || 'Your changes were submitted and are pending registrar approval.'
        });
        setFile(null); // Clear file on success
      }
    } catch (err) {
      // Check for specific validation errors like missing document
      const errors = err?.response?.data?.errors;
      let msg = err?.response?.data?.message || 'Failed to submit changes.';
      
      if (errors?.supporting_document) {
        msg = errors.supporting_document[0];
      }
      
      setSaveStatus({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="sd-content">
        <div className="sd-enrollment-section">
          <h2 className="sd-section-title sd-title-red">Student Information Sheet (SIS)</h2>
          <p className="text-gray-600">Loading…</p>
        </div>
      </section>
    );
  }

  const fullName = student
    ? `${(student.last_name || '').toUpperCase()}, ${(student.first_name || '').toUpperCase()} ${student.middle_name ? student.middle_name.toUpperCase() : ''}`.trim()
    : '—';

  return (
    <section className="sd-content">
      <form onSubmit={handleSubmit}>
        <div className="sd-enrollment-section">
          <h2 className="sd-section-title sd-title-red">Student Information Sheet (SIS) / SIUF</h2>
          <p className="sd-filter-hint">
            Update the fields below as required by the Registrar.
          </p>

          {error && (
            <div className="mx-0 mt-3 p-3 rounded-lg border text-sm bg-red-50 border-red-200 text-red-800" role="alert">
              {error}
            </div>
          )}

          <h3 className="sd-section-title sd-title-red" style={{ fontSize: 18, marginTop: 20 }}>Personal Information</h3>

          <div className="sd-cards-row" style={{ gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="block text-sm font-semibold mb-1">Student Name</label>
              <input
                type="text"
                value={fullName}
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                readOnly
              />
            </div>
            <div style={{ width: 260 }}>
              <label className="block text-sm font-semibold mb-1">Date of Birth</label>
              <input
                type="text"
                value={student?.date_of_birth || ''}
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                readOnly
              />
            </div>
          </div>

          <div className="sd-cards-row" style={{ gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="block text-sm font-semibold mb-1">Address</label>
              <input
                name="address"
                type="text"
                value={form.address}
                onChange={onChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div style={{ width: 280 }}>
              <label className="block text-sm font-semibold mb-1">Place of Birth</label>
              <input
                name="place_of_birth"
                type="text"
                value={form.place_of_birth}
                onChange={onChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div className="sd-cards-row" style={{ gap: 12 }}>
            <div style={{ width: 220 }}>
              <label className="block text-sm font-semibold mb-1">Sex</label>
              <select
                name="sex"
                value={form.sex}
                onChange={onChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="">Select…</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="block text-sm font-semibold mb-1">Name of Guardian</label>
              <input
                name="guardian_name"
                type="text"
                value={form.guardian_name}
                onChange={onChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div style={{ width: 260 }}>
              <label className="block text-sm font-semibold mb-1">Citizenship</label>
              <select
                name="citizenship"
                value={form.citizenship}
                onChange={onChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white"
              >
                <option value="">Select citizenship…</option>
                {CITIZENSHIP_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="sd-cards-row" style={{ gap: 12 }}>
            <div style={{ width: 260 }}>
              <label className="block text-sm font-semibold mb-1">Contact Number</label>
              <input
                name="contact_number"
                type="text"
                value={form.contact_number}
                onChange={onChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="block text-sm font-semibold mb-1">Email</label>
              <input
                type="text"
                value={student?.email || ''}
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                readOnly
              />
            </div>
          </div>
        </div>

        <div className="sd-enrollment-section mt-6">
          <h3 className="sd-section-title sd-title-red" style={{ fontSize: 18 }}>Entrance Data</h3>

          <div className="sd-cards-row" style={{ gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="block text-sm font-semibold mb-1">Elementary School</label>
              <input
                name="elementary_school"
                type="text"
                value={form.elementary_school}
                onChange={onChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div style={{ width: 160 }}>
              <label className="block text-sm font-semibold mb-1">Year</label>
              <input
                name="elementary_year"
                type="number"
                value={form.elementary_year}
                onChange={onChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                min={1900}
                max={2100}
              />
            </div>
          </div>

          <div className="sd-cards-row" style={{ gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="block text-sm font-semibold mb-1">High School</label>
              <input
                name="high_school"
                type="text"
                value={form.high_school}
                onChange={onChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div style={{ width: 160 }}>
              <label className="block text-sm font-semibold mb-1">Year</label>
              <input
                name="high_school_year"
                type="number"
                value={form.high_school_year}
                onChange={onChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                min={1900}
                max={2100}
              />
            </div>
          </div>

          <div className="sd-cards-row" style={{ gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="block text-sm font-semibold mb-1">Previous School</label>
              <input
                name="previous_school"
                type="text"
                value={form.previous_school}
                onChange={onChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="block text-sm font-semibold mb-1">Previous Course</label>
              <input
                name="previous_course"
                type="text"
                value={form.previous_course}
                onChange={onChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div className="sd-cards-row" style={{ marginTop: 24 }}>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 w-full">
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Supporting Document <span className="text-gray-500 font-normal">(Optional unless modifying personal/background info)</span>
              </label>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.pdf,.docx"
                onChange={(e) => setFile(e.target.files[0] || null)}
                className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              <p className="mt-2 text-xs text-gray-500">
                Required for changes to address, school information, or graduation year. Accepted files: PNG, JPG, PDF, DOCX (Max 5MB).
              </p>
            </div>
          </div>

          <div className="sd-cards-row" style={{ justifyContent: 'flex-end', marginTop: 14, alignItems: 'center', gap: 12 }}>
            {saveStatus && (
              <div 
                className={`text-sm px-4 py-2 rounded-md ${
                  saveStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                  saveStatus.type === 'info' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                  'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {saveStatus.message}
              </div>
            )}
            <button
              type="submit"
              className="sd-quick-link"
              style={{ width: 220, justifyContent: 'center' }}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
};

export default StudentSISPage;
