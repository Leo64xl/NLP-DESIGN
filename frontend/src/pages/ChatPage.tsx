import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Chat from '../components/context/global/context-chat/chat/Chat';
import Layout from '../components/layouts/Layout';
import { getMe } from '../features/authSlice';
import type { AppDispatch } from '../app/store';

const ChatPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { isError } = useSelector((state: any) => state.auth);

  useEffect(() => {
    dispatch(getMe());
  }, [dispatch]);

  useEffect(() => {
    if (isError) {
      navigate('/');
    }
  }, [isError, navigate]);

  return (
    <Layout>
      <Chat />
    </Layout>
  );
};

export default ChatPage;