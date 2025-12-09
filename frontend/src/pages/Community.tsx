import { Users, MessageCircle, TrendingUp, AlertTriangle } from 'lucide-react'

export default function Community() {
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Community Safety</h1>
          <p className="text-gray-600 dark:text-gray-300">Connect with others and share safety information</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="card text-center">
                <Users className="h-8 w-8 text-primary-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">1,234</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Active Users</p>
              </div>
              <div className="card text-center">
                <MessageCircle className="h-8 w-8 text-success-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">567</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Reports Today</p>
              </div>
              <div className="card text-center">
                <TrendingUp className="h-8 w-8 text-warning-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">89%</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Safe Areas</p>
              </div>
            </div>

            {/* Community Feed */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Updates</h2>

              <div className="space-y-4">
                {/* Sample Post 1 */}
                <div className="border-b border-gray-200 pb-4 last:border-0">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white">Community Member</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">2 hours ago</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        Just completed a safe route through Adyar. Streets were well-lit and felt very secure.
                        Recommend for evening travel.
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <button className="hover:text-primary-600">👍 12</button>
                        <button className="hover:text-primary-600">💬 3 comments</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sample Post 2 */}
                <div className="border-b border-gray-200 pb-4 last:border-0">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 h-10 w-10 bg-warning-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-warning-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white">Safety Alert</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">4 hours ago</span>
                        <span className="text-xs bg-warning-100 text-warning-700 px-2 py-0.5 rounded">Alert</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        Construction work reported near Chennai Central. Consider alternate routes during peak hours.
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <button className="hover:text-primary-600">👍 45</button>
                        <button className="hover:text-primary-600">💬 8 comments</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Empty state for no posts */}
                <div className="hidden text-center py-8">
                  <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No recent updates</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Safety Tips */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Safety Tips</h2>
              <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                <li className="flex items-start space-x-2">
                  <span className="text-success-600 mt-0.5">•</span>
                  <span>Always share your route with trusted contacts</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-success-600 mt-0.5">•</span>
                  <span>Stay in well-lit areas during evening hours</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-success-600 mt-0.5">•</span>
                  <span>Keep emergency contacts easily accessible</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-success-600 mt-0.5">•</span>
                  <span>Trust your instincts and report concerns</span>
                </li>
              </ul>
            </div>

            {/* Quick Actions */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <button className="w-full btn btn-primary text-sm">Report an Issue</button>
                <button className="w-full btn btn-secondary text-sm">Share Safety Tip</button>
                <button className="w-full btn btn-secondary text-sm">View Heat Map</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
