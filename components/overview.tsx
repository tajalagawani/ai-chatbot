import { motion } from 'framer-motion';
import Link from 'next/link';

export const Overview = () => {
  return (
    <motion.div
      key="overview"
      className="max-w-5xl mx-auto md:mt-16"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: 0.5 }}
    >
      <div className="rounded-xl p-8 flex flex-col gap-8 leading-relaxed text-center max-w-3xl mx-auto ">
        <h1 className="text-5xl font-bold text-white mb-4">Orcha</h1>
        
        <div className="text-3xl font-semibold text-white">
          Good Morning Taj!
        </div>
        
        <div className="mt-6 text-xl text-white">
          <p className="mb-4">
            Welcome to your personalized dashboard. Have a wonderful and productive day!
          </p>
          
          <p>
            <Link
              className="font-medium underline underline-offset-4 text-white hover:text-yellow-200"
              href="#"
            >
              View your calendar
            </Link>
            {' '} | {' '}
            <Link
              className="font-medium underline underline-offset-4 text-white hover:text-yellow-200"
              href="#"
            >
              Latest notifications
            </Link>
          </p>
        </div>
      </div>
    </motion.div>
  );
};