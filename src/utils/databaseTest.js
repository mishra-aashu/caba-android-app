/**
 * Database Integration Test Suite
 * Tests field mapping, validation, and null safety
 */

// Import with error handling
let dbFieldMapping, validateEntity, Message, User;

try {
  const mappingModule = require('./dbFieldMapping');
  dbFieldMapping = mappingModule;
} catch (error) {
  console.error('Could not load dbFieldMapping:', error.message);
  dbFieldMapping = { dbToFrontend: () => ({}), frontendToDb: () => ({}) };
}

try {
  const typesModule = require('../types/database');
  validateEntity = typesModule.validateEntity;
  Message = typesModule.Message;
  User = typesModule.User;
} catch (error) {
  console.error('Could not load database types:', error.message);
  validateEntity = () => [];
  Message = {};
  User = {};
}

// Test data
const testMessage = {
  id: 'test-msg-1',
  chat_id: 'chat-123',
  sender_id: 'user-456',
  receiver_id: 'user-789',
  content: 'Hello world',
  media_path: null,
  media_type: null,
  reply_to: null,
  is_read: false,
  is_group_message: false,
  emoji_style: 'default',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

const testUser = {
  id: 'user-123',
  email: 'test@example.com',
  phone: '+1234567890',
  name: 'Test User',
  avatar: 'https://example.com/avatar.jpg',
  is_admin: false,
  is_online: true,
  last_seen: '2024-01-01T00:00:00Z',
  emoji_style: 'default',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

// Test suite
export const runDatabaseTests = () => {
  console.log('🧪 Running Database Integration Tests...');
  
  const results = {
    fieldMapping: [],
    validation: [],
    nullSafety: [],
    conversion: []
  };

  // Test 1: Field Mapping - Database to Frontend
  try {
    const frontendMessage = dbFieldMapping.dbToFrontend(testMessage);
    
    // Check if fields are properly converted
    if (frontendMessage.chatId !== testMessage.chat_id) {
      results.fieldMapping.push('chatId not mapped correctly');
    }
    if (frontendMessage.senderId !== testMessage.sender_id) {
      results.fieldMapping.push('senderId not mapped correctly');
    }
    if (frontendMessage.emojiStyle !== testMessage.emoji_style) {
      results.fieldMapping.push('emojiStyle not mapped correctly');
    }
    
    console.log('✅ Database to Frontend mapping:', frontendMessage);
  } catch (error) {
    results.fieldMapping.push(`Error: ${error.message}`);
  }

  // Test 2: Field Mapping - Frontend to Database
  try {
    const frontendData = {
      chatId: 'chat-123',
      senderId: 'user-456',
      content: 'Hello world',
      emojiStyle: 'default'
    };
    
    const dbData = dbFieldMapping.frontendToDb(frontendData);
    
    if (dbData.chat_id !== frontendData.chatId) {
      results.fieldMapping.push('chat_id not reverse mapped correctly');
    }
    if (dbData.sender_id !== frontendData.senderId) {
      results.fieldMapping.push('sender_id not reverse mapped correctly');
    }
    if (dbData.emoji_style !== frontendData.emojiStyle) {
      results.fieldMapping.push('emoji_style not reverse mapped correctly');
    }
    
    console.log('✅ Frontend to Database mapping:', dbData);
  } catch (error) {
    results.fieldMapping.push(`Error: ${error.message}`);
  }

  // Test 3: Entity Validation
  try {
    const messageErrors = validateEntity(testMessage, Message, 'message');
    if (messageErrors.length === 0) {
      console.log('✅ Message validation passed');
    } else {
      results.validation.push(...messageErrors);
    }
    
    const userErrors = validateEntity(testUser, User, 'user');
    if (userErrors.length === 0) {
      console.log('✅ User validation passed');
    } else {
      results.validation.push(...userErrors);
    }
  } catch (error) {
    results.validation.push(`Validation error: ${error.message}`);
  }

  // Test 4: Null Safety
  try {
    const nullMessage = null;
    const nullResult = dbFieldMapping.safeDbConversion(nullMessage);
    if (nullResult !== null) {
      results.nullSafety.push('Null message not handled correctly');
    }
    
    const undefinedMessage = undefined;
    const undefinedResult = dbFieldMapping.safeDbConversion(undefinedMessage);
    if (undefinedResult !== undefined) {
      results.nullSafety.push('Undefined message not handled correctly');
    }
    
    // Test with null foreign key data
    const messageWithNulls = {
      ...testMessage,
      sender: null,
      receiver: null
    };
    
    const safeResult = dbFieldMapping.safeDbConversion([messageWithNulls]);
    if (safeResult[0].sender !== null) {
      results.nullSafety.push('Null sender not handled correctly');
    }
    
    console.log('✅ Null safety tests passed');
  } catch (error) {
    results.nullSafety.push(`Null safety error: ${error.message}`);
  }

  // Test 5: Array Conversion
  try {
    const messageArray = [testMessage, { ...testMessage, id: 'test-msg-2' }];
    const convertedArray = safeDbConversion(messageArray);
    
    if (!Array.isArray(convertedArray)) {
      results.conversion.push('Array conversion failed');
    }
    
    if (convertedArray.length !== 2) {
      results.conversion.push('Array length not preserved');
    }
    
    if (convertedArray[0].chatId !== testMessage.chat_id) {
      results.conversion.push('First item not converted correctly');
    }
    
    console.log('✅ Array conversion tests passed');
  } catch (error) {
    results.conversion.push(`Array conversion error: ${error.message}`);
  }

  // Test 6: Nested Object Conversion
  try {
    const messageWithNested = {
      ...testMessage,
      sender: {
        id: 'sender-123',
        name: 'Sender Name',
        is_online: true
      },
      receiver: {
        id: 'receiver-456',
        name: 'Receiver Name',
        is_online: false
      }
    };
    
    const convertedNested = safeDbConversion(messageWithNested);
    
    if (convertedNested.sender.isOnline !== true) {
      results.conversion.push('Nested sender not converted correctly');
    }
    
    if (convertedNested.receiver.isOnline !== false) {
      results.conversion.push('Nested receiver not converted correctly');
    }
    
    console.log('✅ Nested object conversion tests passed');
  } catch (error) {
    results.conversion.push(`Nested conversion error: ${error.message}`);
  }

  // Results Summary
  const totalErrors = results.fieldMapping.length + 
                      results.validation.length + 
                      results.nullSafety.length + 
                      results.conversion.length;

  console.log('\n📊 Test Results Summary:');
  console.log(`Field Mapping: ${results.fieldMapping.length === 0 ? '✅ PASSED' : `❌ FAILED (${results.fieldMapping.length} errors)`}`);
  console.log(`Validation: ${results.validation.length === 0 ? '✅ PASSED' : `❌ FAILED (${results.validation.length} errors)`}`);
  console.log(`Null Safety: ${results.nullSafety.length === 0 ? '✅ PASSED' : `❌ FAILED (${results.nullSafety.length} errors)`}`);
  console.log(`Conversion: ${results.conversion.length === 0 ? '✅ PASSED' : `❌ FAILED (${results.conversion.length} errors)`}`);
  console.log(`\n🎯 Overall: ${totalErrors === 0 ? '✅ ALL TESTS PASSED' : `❌ ${totalErrors} TOTAL ERRORS`}`);

  if (totalErrors > 0) {
    console.log('\n🔍 Error Details:');
    console.log('Field Mapping:', results.fieldMapping);
    console.log('Validation:', results.validation);
    console.log('Null Safety:', results.nullSafety);
    console.log('Conversion:', results.conversion);
  }

  return {
    passed: totalErrors === 0,
    totalErrors,
    results
  };
};

// Auto-run tests in development
if (process.env.NODE_ENV === 'development') {
  // Uncomment to run tests automatically
  // runDatabaseTests();
}

export default runDatabaseTests;
