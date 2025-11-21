import { Injectable, signal } from '@angular/core';
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAuthenticatedSignal = signal<boolean>(false);
  private currentUserSignal = signal<string | null>(null);
  private userIdSignal = signal<string | null>(null);
  isAuthenticated = this.isAuthenticatedSignal.asReadonly();
  currentUser = this.currentUserSignal.asReadonly();
  userId = this.userIdSignal.asReadonly();
  login(username: string, userId?: string) {
    this.isAuthenticatedSignal.set(true);
    this.currentUserSignal.set(username);
    if (userId) {
      this.userIdSignal.set(userId);
      localStorage.setItem('userId', userId);
      localStorage.setItem('username', username);
    }
  }
  logout() {
    this.isAuthenticatedSignal.set(false);
    this.currentUserSignal.set(null);
    this.userIdSignal.set(null);
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
  }
  restoreSession() {
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    if (userId && username) {
      this.isAuthenticatedSignal.set(true);
      this.currentUserSignal.set(username);
      this.userIdSignal.set(userId);
    }
  }
}
