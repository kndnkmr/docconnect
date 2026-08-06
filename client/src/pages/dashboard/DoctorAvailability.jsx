import { useState, useEffect } from 'react';
import { availabilityAPI } from '../../services/api';
import toast from 'react-hot-toast';

function DoctorAvailability() {
  const [schedule, setSchedule] = useState([]);
  const [slotDuration, setSlotDuration] = useState(30);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState([]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const response = await availabilityAPI.getMine();
        setSchedule(response.data.availability || []);
        setSlotDuration(response.data.slotDuration || 30);
      } catch (error) {
        console.error('Fetch availability error:', error);
      } finally { setLoading(false); }
    };
    fetchAvailability();
  }, []);

  const toggleDay = (day) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };
  const selectWeekdays = () => setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  const clearDays = () => setSelectedDays([]);

  const handleAddSlots = () => {
    if (selectedDays.length === 0) { toast.error('Please select at least one day'); return; }
    if (startTime >= endTime) { toast.error('Start time must be before end time'); return; }
    const newSlots = selectedDays.map(day => ({ day, startTime, endTime }));
    const filteredNewSlots = newSlots.filter(newSlot =>
      !schedule.some(existing => existing.day === newSlot.day && existing.startTime === newSlot.startTime && existing.endTime === newSlot.endTime)
    );
    if (filteredNewSlots.length === 0) { toast.error('These slots already exist in your schedule'); return; }
    setSchedule(prev => [...prev, ...filteredNewSlots]);
    toast.success(`Added ${filteredNewSlots.length} slot(s) to schedule`);
  };

  const handleRemoveSlot = (index) => setSchedule(prev => prev.filter((_, i) => i !== index));
  const handleRemoveDay = (day) => { setSchedule(prev => prev.filter(slot => slot.day !== day)); toast.success(`Removed all ${day} slots`); };

  const handleSave = async () => {
    try {
      await availabilityAPI.set({ availability: schedule, slotDuration });
      toast.success('Availability saved!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save availability');
    }
  };

  const groupedSchedule = days.reduce((acc, day) => {
    const daySlots = schedule.filter(slot => slot.day === day);
    if (daySlots.length > 0) acc[day] = daySlots;
    return acc;
  }, {});

  if (loading) return <div className="text-center py-8 text-gray-600">Loading...</div>;

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Set Your Weekly Schedule</h2>

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Appointment Duration (minutes)</label>
        <select value={slotDuration} onChange={(e) => setSlotDuration(Number(e.target.value))} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={45}>45 minutes</option>
          <option value={60}>60 minutes</option>
        </select>
        <p className="text-sm text-gray-500 mt-1">Each booking slot will be this long</p>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="font-medium text-gray-800 mb-4">Add Available Time</h3>
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-2">Select Days</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {days.map(day => (
              <button key={day} type="button" onClick={() => toggleDay(day)} className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${selectedDays.includes(day) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {day.substring(0, 3)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={selectWeekdays} className="text-xs text-primary-600 hover:underline">Select Mon-Sat</button>
            <span className="text-gray-300">|</span>
            <button type="button" onClick={clearDays} className="text-xs text-gray-500 hover:underline">Clear all</button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-sm text-gray-600 mb-1">From</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">To</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <button onClick={handleAddSlots} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">+ Add to {selectedDays.length || 0} day(s)</button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Tip: Select multiple days, set the time, and click Add.</p>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="font-medium text-gray-800 mb-4">Your Current Schedule</h3>
        {Object.keys(groupedSchedule).length === 0 ? (
          <p className="text-gray-500 text-center py-4">No availability set yet. Select days and time above, then click Add.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedSchedule).map(([day, slots]) => (
              <div key={day} className="border border-gray-200 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-800">{day}</span>
                  <button onClick={() => handleRemoveDay(day)} className="text-red-400 hover:text-red-600 text-xs">Remove all {day}</button>
                </div>
                <div className="space-y-1">
                  {slots.map((slot, idx) => {
                    const actualIndex = schedule.findIndex(
                      (s, i) => s.day === slot.day && s.startTime === slot.startTime && s.endTime === slot.endTime &&
                      schedule.slice(0, i).filter(x => x.day === slot.day && x.startTime === slot.startTime && x.endTime === slot.endTime).length === idx
                    );
                    return (
                      <div key={idx} className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded">
                        <span className="text-gray-600 text-sm">{slot.startTime} — {slot.endTime}</span>
                        <button onClick={() => handleRemoveSlot(actualIndex >= 0 ? actualIndex : schedule.indexOf(slot))} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={handleSave} className="bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors">
        Save Availability
      </button>
    </div>
  );
}

export default DoctorAvailability;
