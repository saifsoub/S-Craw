import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Flame, UserPlus, Calendar, Activity, TrendingUp } from 'lucide-react';
import Chart from 'chart.js/auto';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.45, ease: 'easeOut' },
  }),
};

const SPortal = () => {
  const [leadsToday, setLeadsToday] = useState(12);
  const [totalLeads, setTotalLeads] = useState(184);
  const [appointmentsToday, setAppointmentsToday] = useState(4);
  const [leadHistory, setLeadHistory] = useState([3, 5, 2, 8, 4, 7, 3, 6, 9, 5]);
  const [wsConnected, setWsConnected] = useState(false);

  const lineRef = useRef<HTMLCanvasElement>(null);
  // Persist the Chart instance across renders so we can destroy it properly
  const lineChartRef = useRef<Chart | null>(null);

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8765/ws/portal');
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as { type: string };
      if (msg.type === 'lead_captured') {
        setLeadsToday((p) => p + 1);
        setTotalLeads((p) => p + 1);
        setLeadHistory((prev) => [...prev.slice(1), prev[prev.length - 1] + 1]);
      }
      if (msg.type === 'appointment_booked') {
        setAppointmentsToday((p) => p + 1);
      }
    };

    return () => ws.close();
  }, []);

  // Rebuild chart whenever leadHistory changes
  useEffect(() => {
    if (!lineRef.current) return;

    // Destroy previous instance before creating a new one
    if (lineChartRef.current) {
      lineChartRef.current.destroy();
    }

    lineChartRef.current = new Chart(lineRef.current, {
      type: 'line',
      data: {
        labels: Array.from({ length: 10 }, (_, i) => `${10 - i}m ago`),
        datasets: [
          {
            label: 'Leads',
            data: leadHistory,
            borderColor: '#E8731A',
            backgroundColor: 'rgba(232,115,26,0.15)',
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: '#E8731A',
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#C9A96E' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#C9A96E' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });

    return () => {
      lineChartRef.current?.destroy();
      lineChartRef.current = null;
    };
  }, [leadHistory]);

  const stats = [
    {
      icon: <UserPlus size={48} className="text-[#41d98f] mx-auto mb-4" />,
      value: leadsToday,
      label: 'LEADS TODAY',
      valueColor: 'text-[#41d98f]',
      border: 'border-[#E8731A]/30',
    },
    {
      icon: <Calendar size={48} className="text-[#E8731A] mx-auto mb-4" />,
      value: appointmentsToday,
      label: 'APPOINTMENTS TODAY',
      valueColor: 'text-[#E8731A]',
      border: 'border-[#C9A96E]/30',
    },
    {
      icon: <Activity size={48} className="text-[#C9A96E] mx-auto mb-4" />,
      value: totalLeads,
      label: 'TOTAL LEADS',
      valueColor: 'text-[#F2EDE4]',
      border: 'border-[#2A2A2A]',
    },
  ];

  return (
    <div className="min-h-screen bg-[#111111] text-[#F2EDE4]">
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="text-5xl font-bold mb-2 flex items-center gap-4"
        >
          <Flame className="text-[#E8731A]" />
          S/PORTAL
        </motion.h1>

        {/* WS status pill */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-8 flex items-center gap-2 text-sm"
        >
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              wsConnected ? 'bg-[#41d98f]' : 'bg-red-500'
            }`}
          />
          <span className="text-[#C9A96E]">
            {wsConnected ? 'Live' : 'Disconnected'}
          </span>
        </motion.div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className={`bg-[#1E1E1E] p-8 rounded-3xl border ${s.border}`}
            >
              {s.icon}
              <div className={`text-7xl font-bold text-center ${s.valueColor}`}>
                {s.value}
              </div>
              <div className="text-center text-[#C9A96E] mt-2 text-sm tracking-widest">
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Line chart */}
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mt-10 bg-[#1E1E1E] p-8 rounded-3xl border border-[#2A2A2A]"
        >
          <h2 className="text-xl mb-6 flex items-center gap-3">
            <TrendingUp className="text-[#E8731A]" />
            Live Leads — Last 10 Minutes
          </h2>
          <canvas ref={lineRef} className="w-full" style={{ height: '320px' }} />
        </motion.div>
      </div>
    </div>
  );
};

export default SPortal;
