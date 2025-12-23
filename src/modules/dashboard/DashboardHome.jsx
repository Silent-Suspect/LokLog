import { useNavigate } from 'react-router-dom';
import { BookOpen, Search, Clock, TrainFront } from 'lucide-react';
import LiveClock from '../../components/LiveClock';

const DashboardHome = () => {
    const navigate = useNavigate();

    const cards = [
        {
            title: 'LokLog',
            description: 'Shift reporting & Logs',
            icon: BookOpen,
            color: 'bg-accent-blue',
            action: () => navigate('/loklog'),
        },
        {
            title: 'Decoder',
            description: 'Signal & Error Codes',
            color: 'bg-accent-purple',
            action: () => navigate('/decoder'),
        },
        {
            title: 'Tracker',
            description: 'External Shift Tracker',
            icon: Clock,
            color: 'bg-accent-green',
            action: () => window.open('https://silent-suspect.github.io/shift-tracker/', '_blank'),
        },
        {
            title: 'Fahrtenbuch',
            description: 'Legacy Travel Log',
            icon: TrainFront,
            color: 'bg-accent-orange',
            action: () => alert('External link placeholder'),
        },
    ];

    return (
        <div className="flex flex-col gap-8 max-w-5xl mx-auto">
            <LiveClock />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
                {cards.map((card, index) => (
                    <button
                        key={index}
                        onClick={card.action}
                        className="flex flex-col items-center justify-center p-8 rounded-2xl bg-card hover:bg-opacity-80 transition-all transform hover:scale-[1.02] border border-gray-800 shadow-lg group"
                    >
                        <div className={`p-4 rounded-full mb-4 ${card.color} bg-opacity-10 group-hover:bg-opacity-20 transition`}>
                            <card.icon size={48} className={`text-${card.color.replace('bg-', '')}`} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">{card.title}</h3>
                        <p className="text-gray-400 font-medium">{card.description}</p>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default DashboardHome;
