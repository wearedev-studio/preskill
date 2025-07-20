import React from 'react';
import { TrendingUp, Clock, Trophy, DollarSign, Target, Users } from 'lucide-react';
// import { useLanguage } from '../App';

const Dashboard: React.FC = () => {
//   const { t } = useLanguage();

  const stats = [
    { title: 'Всего игр', value: '1,247', icon: Target, color: 'bg-blue-600' },
    { title: 'Процент побед', value: '78%', icon: Trophy, color: 'bg-green-600' },
    { title: 'Часов сыграно', value: '234ч', icon: Clock, color: 'bg-purple-600' },
    { title: 'Заработано', value: '$2,450', icon: DollarSign, color: 'bg-yellow-600' },
  ];

  const recentGames = [
    { game: 'Шахматы', opponent: 'Алексей Томпсон', result: 'Победа', time: '2 часа назад' },
    { game: 'Шашки', opponent: 'Мария Гарсия', result: 'Победа', time: '4 часа назад' },
    { game: 'Нарды', opponent: 'Давид Чен', result: 'Поражение', time: '1 день назад' },
    { game: 'Крестики-нолики', opponent: 'Сара Джонсон', result: 'Победа', time: '1 день назад' },
  ];

  const upcomingTournaments = [
    { name: 'Кубок мастеров шахмат', date: '15 марта 2025', prize: '$5,000', participants: 64 },
    { name: 'Чемпионат по нардам', date: '20 марта 2025', prize: '$3,000', participants: 32 },
    { name: 'Фестиваль стратегических игр', date: '25 марта 2025', prize: '$10,000', participants: 128 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Панель управления</h1>
          <p className="text-slate-400">Добро пожаловать, Иван! Готовы к следующей игре?</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <p className="text-sm text-slate-400">Текущий ранг</p>
            <p className="text-lg font-bold text-blue-400">Мастер</p>
          </div>
          <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-800 rounded-full flex items-center justify-center">
            <Trophy className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.title} className="bg-slate-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">{stat.title}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity and Tournaments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Games */}
        <div className="bg-slate-800 rounded-lg shadow-sm p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Последние игры</h2>
            <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
              {/* {t('viewAll')} */}
            </button>
          </div>
          <div className="space-y-3">
            {recentGames.map((game, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-800 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">{game.game.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-medium text-white">{game.game}</p>
                    <p className="text-sm text-slate-400">против {game.opponent}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    game.result === 'Победа' ? 'bg-green-900 text-green-100' : 'bg-red-900 text-red-100'
                  }`}>
                    {game.result}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">{game.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Tournaments */}
        <div className="bg-slate-800 rounded-lg shadow-sm p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Предстоящие турниры</h2>
            <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
              {/* {t('viewAll')} */}
            </button>
          </div>
          <div className="space-y-3">
            {upcomingTournaments.map((tournament, index) => (
              <div key={index} className="p-4 border border-slate-600 rounded-lg hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-white">{tournament.name}</h3>

                  <span className="text-green-400 font-bold">{tournament.prize}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>{tournament.date}</span>
                  <div className="flex items-center space-x-1">
                    <Users className="w-4 h-4" />
                    <span>{tournament.participants} игроков</span>
                  </div>
                </div>
                <button className="mt-2 w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors">
                  Зарегистрироваться
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;