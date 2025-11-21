import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { HttpClient } from '@angular/common/http';
interface FormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}
interface Errors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}
@Component({
  selector: 'app-create-profile',
  imports: [CommonModule, FormsModule],
  templateUrl: './create-profile.html',
  styleUrl: './create-profile.css',
})
export class CreateProfile {
  private router = inject(Router);
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api';
  mode: 'create' | 'login' = 'create';
  isSubmitting: boolean = false;
  submitted: boolean = false;
  formData: FormData = {
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  };
  errors: Errors = {};
  setMode(mode: 'create' | 'login') {
    this.mode = mode;
    this.errors = {};
    this.formData = {
      username: '',
      email: '',
      password: '',
      confirmPassword: ''
    };
  }
  validateForm(): boolean {
    this.errors = {};
    let isValid = true;
    if (this.mode === 'create') {
      if (!this.formData.username || this.formData.username.length < 3) {
        this.errors.username = 'El nombre de usuario debe tener al menos 3 caracteres';
        isValid = false;
      }
    }
    if (!this.formData.email || !this.formData.email.includes('@')) {
      this.errors.email = 'Ingresa un email válido';
      isValid = false;
    }
    if (!this.formData.password || this.formData.password.length < 6) {
      this.errors.password = 'La contraseña debe tener al menos 6 caracteres';
      isValid = false;
    }
    if (this.mode === 'create') {
      if (this.formData.password !== this.formData.confirmPassword) {
        this.errors.confirmPassword = 'Las contraseñas no coinciden';
        isValid = false;
      }
    }
    return isValid;
  }
  onSubmit() {
    if (!this.validateForm()) {
      return;
    }
    this.isSubmitting = true;
    if (this.mode === 'create') {
      this.http.post(`${this.apiUrl}/auth/register`, {
        username: this.formData.username,
        email: this.formData.email,
        password: this.formData.password
      }).subscribe({
        next: (response: any) => {
          this.authService.login(response.username, response.userId);
          this.isSubmitting = false;
          this.router.navigate(['/user-profile']);
        },
        error: (error) => {
          this.errors.email = error.error?.message || 'Error al crear la cuenta';
          this.isSubmitting = false;
        }
      });
    } else {
      this.http.post(`${this.apiUrl}/auth/login`, {
        email: this.formData.email,
        password: this.formData.password
      }).subscribe({
        next: (response: any) => {
          this.authService.login(response.username, response.userId);
          this.isSubmitting = false;
          this.router.navigate(['/user-profile']);
        },
        error: (error) => {
          this.errors.email = error.error?.message || 'Credenciales inválidas';
          this.isSubmitting = false;
        }
      });
    }
  }
  continueToApp() {
    this.router.navigate(['/user-profile']);
  }
}
