import React from 'react';
import Modal from '../common/Modal';
import AddMembers from './AddMembers';

const AddMembersModal = ({ isOpen, onClose, groupId, existingMemberIds = [], onSuccess }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Participants"
      size="small"
      bodyClassName="add-members-modal-body"
    >
      <AddMembers 
        groupId={groupId}
        existingMemberIds={existingMemberIds}
        onSuccess={onSuccess}
        onClose={onClose}
        isSidebar={false}
      />
    </Modal>
  );
};

export default AddMembersModal;
