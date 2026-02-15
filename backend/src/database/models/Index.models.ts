import User from './User.model';
import Token from './Token.model';
import Design from './Design.model';
import Message from './Message.model';
import DesignFile from './DesignFile.model';

User.hasMany(Token, {
  foreignKey: 'userId',     
  sourceKey: 'uuid',        
  as: 'tokens'
});

Token.belongsTo(User, {
  foreignKey: 'userId',    
  targetKey: 'uuid',        
  as: 'user'
});

User.hasMany(Design, {
  foreignKey: 'userId',
  sourceKey: 'uuid',
  as: 'designs'
});

Design.belongsTo(User, {
  foreignKey: 'userId',
  targetKey: 'uuid',
  as: 'user'
});

Design.hasMany(Message, {
  foreignKey: 'designId',
  sourceKey: 'uuid',
  as: 'messages'
});

Message.belongsTo(Design, {
  foreignKey: 'designId',
  targetKey: 'uuid',
  as: 'design'
});

Design.hasMany(DesignFile, {
  foreignKey: 'designId',
  sourceKey: 'uuid',
  as: 'files'
});

DesignFile.belongsTo(Design, {
  foreignKey: 'designId',
  targetKey: 'uuid',
  as: 'design'
});

Message.hasMany(DesignFile, {
  foreignKey: 'messageId',
  sourceKey: 'uuid',
  as: 'files'
});

DesignFile.belongsTo(Message, {
  foreignKey: 'messageId',
  targetKey: 'uuid',
  as: 'message'
});

export { User, Token, Design, Message, DesignFile };

const models = {
  User,
  Token,
  Design,
  Message,
  DesignFile
};

export default models;