import React from 'react';
import { 
  Calendar, Clock, MapPin, Bell, ChevronRight, 
  Pill, Users, CalendarCheck, Cake, ClipboardList 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './ReminderMessage.module.css';

/**
 * ReminderMessage Component
 * Renders a rich media card for shared reminders within chat bubbles.
 * Provides quick glance at title, time, location and priority.
 */
const ReminderMessage = ({ message, isMine }) => {
  const navigate = useNavigate();
  const reminder = message.metadata?.reminder;
  
  if (!reminder) return null;

  const categoryIcons = {
    medicine: Pill,
    meeting: Users,
    appointment: CalendarCheck,
    birthday: Cake,
    task: ClipboardList
  };

  const CategoryIcon = categoryIcons[reminder.category] || Bell;

  const handleViewReminder = () => {
    // Navigate to reminders page
    navigate('/reminders');
  };

  const reminderTime = new Date(reminder.reminder_time);
  const formattedDate = reminderTime.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: reminderTime.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  });
  
  const formattedTime = reminderTime.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });

  const priorityLabel = reminder.priority?.toUpperCase() || 'NORMAL';

  return (
    <div className={`${styles.reminderContainer} ${isMine ? styles.mine : styles.theirs}`}>
      <div className={`${styles.reminderCard} ${styles[`priority-${reminder.priority || 'medium'}`]}`}>
        
        {/* Card Header */}
        <div className={styles.cardHeader}>
          <div className={styles.iconWrapper}>
            <CategoryIcon size={20} className={styles.categoryIcon} />
          </div>
          <div className={styles.titleSection}>
            <h4 className={styles.reminderTitle}>{reminder.title}</h4>
            <div className={styles.priorityLabel}>{priorityLabel} PRIORITY</div>
          </div>
        </div>

        {/* Card Body */}
        <div className={styles.cardBody}>
          {reminder.description && (
            <p className={styles.description}>{reminder.description}</p>
          )}
          
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <Calendar size={12} className={styles.metaIcon} />
              <span>{formattedDate}</span>
            </div>
            <div className={styles.metaItem}>
              <Clock size={12} className={styles.metaIcon} />
              <span>{formattedTime}</span>
            </div>
            {reminder.location && (
              <div className={styles.metaItem}>
                <MapPin size={12} className={styles.metaIcon} />
                <span className={styles.locationText}>{reminder.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <button className={styles.actionBtn} onClick={handleViewReminder}>
          <span>VIEW DETAILS</span>
          <ChevronRight size={14} />
        </button>
        
        {/* Footer */}
        <div className={styles.cardFooter}>
          <Bell size={10} />
          <span>{isMine ? 'You scheduled this' : 'New reminder for you'}</span>
        </div>
      </div>
    </div>
  );
};

export default ReminderMessage;
