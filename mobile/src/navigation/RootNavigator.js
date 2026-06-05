import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import { Loader } from '../components/ui';

import AuthScreen from '../screens/AuthScreen';
import PaywallScreen from '../screens/PaywallScreen';
import JobsListScreen from '../screens/JobsListScreen';
import JobDetailScreen from '../screens/JobDetailScreen';
import MyApplicationsScreen from '../screens/MyApplicationsScreen';
import MyJobsScreen from '../screens/MyJobsScreen';
import PostJobScreen from '../screens/PostJobScreen';
import JobApplicantsScreen from '../screens/JobApplicantsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import ChatScreen from '../screens/ChatScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ReviewsScreen from '../screens/ReviewsScreen';
import LeaveReviewScreen from '../screens/LeaveReviewScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { color: colors.text },
  headerTintColor: colors.primary,
  contentStyle: { backgroundColor: colors.bg },
};

function tabIcon(emoji) {
  return ({ focused }) => (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

const tabOptions = {
  ...screenOptions,
  tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
};

function WorkerTabs() {
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen
        name="Jobs"
        component={JobsListScreen}
        options={{ title: 'משרות', tabBarIcon: tabIcon('🔍') }}
      />
      <Tab.Screen
        name="MyApplications"
        component={MyApplicationsScreen}
        options={{ title: 'המועמדויות שלי', tabBarIcon: tabIcon('📋') }}
      />
      <Tab.Screen
        name="Conversations"
        component={ConversationsScreen}
        options={{ title: 'שיחות', tabBarIcon: tabIcon('💬') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'פרופיל', tabBarIcon: tabIcon('👤') }}
      />
    </Tab.Navigator>
  );
}

function ContractorTabs() {
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen
        name="MyJobs"
        component={MyJobsScreen}
        options={{ title: 'המשרות שלי', tabBarIcon: tabIcon('🏗️') }}
      />
      <Tab.Screen
        name="Conversations"
        component={ConversationsScreen}
        options={{ title: 'שיחות', tabBarIcon: tabIcon('💬') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'פרופיל', tabBarIcon: tabIcon('👤') }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) return <Loader />;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={screenOptions}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen
              name="Home"
              component={user.role === 'contractor' ? ContractorTabs : WorkerTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="JobDetail"
              component={JobDetailScreen}
              options={{ title: 'פרטי משרה' }}
            />
            <Stack.Screen
              name="JobApplicants"
              component={JobApplicantsScreen}
              options={({ route }) => ({ title: route.params?.title || 'מועמדים' })}
            />
            <Stack.Screen
              name="PostJob"
              component={PostJobScreen}
              options={{ title: 'פרסום משרה' }}
            />
            <Stack.Screen
              name="Paywall"
              component={PaywallScreen}
              options={{ title: 'מנוי', presentation: 'modal' }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({ title: route.params?.title || 'שיחה' })}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ title: 'התראות' }}
            />
            <Stack.Screen
              name="Reviews"
              component={ReviewsScreen}
              options={({ route }) => ({ title: `ביקורות — ${route.params?.name || ''}` })}
            />
            <Stack.Screen
              name="LeaveReview"
              component={LeaveReviewScreen}
              options={{ title: 'השאר ביקורת', presentation: 'modal' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
