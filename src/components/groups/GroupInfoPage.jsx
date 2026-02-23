import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGroupActions } from '../../hooks/useGroupActions';
import GroupInfoDrawer from './GroupInfoDrawer';
import { useAuth } from '../../hooks/useAuth';
import './GroupInfoDrawer.css';

const GroupInfoPage = () => {
    const { chatId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { useGroup } = useGroupActions(chatId);
    const { data: group, isLoading } = useGroup(chatId);

    const handleClose = () => {
        navigate(-1);
    };

    if (isLoading) {
        return (
            <div className="loading-page">
                <div className="loading-spinner"></div>
                <p>Loading group info...</p>
            </div>
        );
    }

    return (
        <div className="group-info-page-wrapper">
            <GroupInfoDrawer
                isOpen={true}
                onClose={handleClose}
                group={group}
                onCallStart={(type) => {
                    // Handle call start logic if needed, or pass it from context
                    console.log(`Starting ${type} call...`);
                }}
            />
        </div>
    );
};

export default GroupInfoPage;
