import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGroup, useGroupMembers } from '../../hooks/useGroupActions';
import AddMembers from './AddMembers';
import { LoaderCircle } from 'lucide-react';
import './AddMembers.css';

const AddMembersPage = () => {
    const { chatId } = useParams();
    const navigate = useNavigate();
    
    const { data: group, isLoading: loadingGroup } = useGroup(chatId);
    const { data: members = [], isLoading: loadingMembers } = useGroupMembers(chatId);

    const handleClose = () => {
        navigate(-1);
    };

    const handleSuccess = () => {
        // We'll let AddMembers internal timeout handle the close if it has one,
        // or we can handle it here.
    };

    if (loadingGroup || loadingMembers) {
        return (
            <div className="add-members-loading">
                <LoaderCircle className="animate-spin" size={40} />
                <p>Loading group details...</p>
            </div>
        );
    }

    return (
        <div className="add-members-page-wrapper">
            <AddMembers
                groupId={chatId}
                existingMemberIds={members.map(m => m.user_id)}
                onClose={handleClose}
                onSuccess={handleSuccess}
                isSidebar={true}
                title={`Add to ${group?.name || 'Group'}`}
            />
        </div>
    );
};

export default AddMembersPage;
