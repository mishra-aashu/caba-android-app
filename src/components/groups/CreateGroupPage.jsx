import React from 'react';
import { useNavigate } from 'react-router-dom';
import CreateGroupModal from './CreateGroupModal';
import { ArrowLeft } from 'lucide-react';
import './CreateGroupModal.css';

const CreateGroupPage = () => {
    const navigate = useNavigate();

    const handleSuccess = (newGroup) => {
        if (newGroup?.id) {
            navigate(`/chat/${newGroup.id}/group`);
        } else {
            navigate('/groups');
        }
    };

    const handleClose = () => {
        navigate(-1);
    };

    return (
        <div className="create-group-page-wrapper">
            <div className="create-group-page-header">
                <button className="back-btn" onClick={handleClose}>
                    <ArrowLeft size={24} />
                </button>
                <h2>Create New Group</h2>
            </div>
            <div className="create-group-page-content">
                <CreateGroupModal
                    isOpen={true}
                    onClose={handleClose}
                    onSuccess={handleSuccess}
                    inline={true}
                />
            </div>
        </div>
    );
};

export default CreateGroupPage;
