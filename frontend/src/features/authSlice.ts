import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

interface LoginPayload {
    email: string;
    password: string;
}

interface User {
    uuid: string;
    username: string;
    email: string;
    role: string;
}

interface AuthState {
    user: User | null;
    isError: boolean;
    isSuccess: boolean;
    isLoading: boolean;
    message: string;
}

const initialState: AuthState = {
    user: null,
    isError: false,
    isSuccess: false,
    isLoading: false,
    message: ""
};

export const LoginUser = createAsyncThunk<User, LoginPayload, { rejectValue: string }>(
  "user/loginUser",
  async (user, thunkAPI) => {
    try {
      const response = await axios.post<User>('http://localhost:5000/login', {
        email: user.email,
        password: user.password
      }, {
        withCredentials: true
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        const message = error.response.data.msg;
        return thunkAPI.rejectWithValue(message);
      }
      return thunkAPI.rejectWithValue("Error desconocido");
    }
  }
);

export const getMe = createAsyncThunk<User, void, { rejectValue: string }>(
  "user/getMe",
  async (_, thunkAPI) => {
    try {
      const response = await axios.get<User>('http://localhost:5000/me', {
        withCredentials: true
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        const message = error.response.data.msg;
        return thunkAPI.rejectWithValue(message);
      }
      return thunkAPI.rejectWithValue("Error desconocido");
    }
  }
);

export const LogOut = createAsyncThunk<void, void, { rejectValue: string }>(
  "user/LogOut",
  async (_, thunkAPI) => {
    try {
      await axios.delete('http://localhost:5000/logout', {
        withCredentials: true
      });
    } catch (error: any) {
      if (error.response) {
        const message = error.response.data.msg;
        return thunkAPI.rejectWithValue(message);
      }
      return thunkAPI.rejectWithValue("Error desconocido");
    }
  }
);

export const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        reset: () => initialState
    },
    extraReducers: (builder) => {
        builder.addCase(LoginUser.pending, (state) => {
            state.isLoading = true;
        });
        builder.addCase(LoginUser.fulfilled, (state, action: PayloadAction<User>) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.user = action.payload;
            state.isError = false;
            state.message = "";
        });
        builder.addCase(LoginUser.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
            state.message = action.payload as string;
            state.user = null;
        });

        builder.addCase(getMe.pending, (state) => {
            state.isLoading = true;
        });
        builder.addCase(getMe.fulfilled, (state, action: PayloadAction<User>) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.user = action.payload;
            state.isError = false;
            state.message = "";
        });
        builder.addCase(getMe.rejected, (state, action) => {
            state.isLoading = false;
            state.isError = true;
            state.message = action.payload as string;
            state.user = null;
        });

        builder.addCase(LogOut.fulfilled, (state) => {
            state.user = null;
            state.isSuccess = false;
            state.isError = false;
            state.isLoading = false;
            state.message = "";
        });
        builder.addCase(LogOut.rejected, (state, action) => {
            state.isError = true;
            state.message = action.payload as string;
        });
    }
});

export const { reset } = authSlice.actions;
export default authSlice.reducer;