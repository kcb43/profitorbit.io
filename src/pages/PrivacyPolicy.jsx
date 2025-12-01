/**
 * Privacy Policy Page
 * 
 * Displays the privacy policy for ProfitPulse
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, Eye, Database, Users, FileText } from 'lucide-react';

export default function PrivacyPolicy() {
  const lastUpdated = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
            Privacy Policy
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Last updated: {lastUpdated}
        </p>
      </div>

      <div className="space-y-6">
        {/* Introduction */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Introduction
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
            <p>
              Welcome to ProfitPulse ("we," "our," or "us"). We are committed to protecting your privacy 
              and ensuring the security of your personal information. This Privacy Policy explains how we 
              collect, use, disclose, and safeguard your information when you use our marketplace 
              crosslisting platform.
            </p>
            <p>
              By using ProfitPulse, you agree to the collection and use of information in accordance 
              with this policy. If you do not agree with our policies and practices, please do not use 
              our service.
            </p>
          </CardContent>
        </Card>

        {/* Information We Collect */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Information We Collect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="font-semibold mb-2">Personal Information</h3>
              <p className="mb-2">We may collect the following types of personal information:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Account information (name, email address, username)</li>
                <li>Payment and billing information</li>
                <li>Profile information and preferences</li>
                <li>Communication data when you contact us</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Marketplace Account Information</h3>
              <p className="mb-2">To enable crosslisting functionality, we collect:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>OAuth tokens and credentials for connected marketplaces (eBay, Facebook Marketplace, etc.)</li>
                <li>Marketplace account identifiers and usernames</li>
                <li>Listing data and inventory information</li>
                <li>Transaction and sales data</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Usage Data</h3>
              <p className="mb-2">We automatically collect information about how you use our service:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Device information (browser type, operating system)</li>
                <li>IP address and location data</li>
                <li>Usage patterns and feature interactions</li>
                <li>Error logs and performance data</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* How We Use Your Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              How We Use Your Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
            <p>We use the collected information for the following purposes:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Service Provision:</strong> To provide, maintain, and improve our crosslisting platform</li>
              <li><strong>Marketplace Integration:</strong> To connect your accounts and manage listings across multiple platforms</li>
              <li><strong>Communication:</strong> To send you updates, notifications, and respond to your inquiries</li>
              <li><strong>Analytics:</strong> To analyze usage patterns and improve our service</li>
              <li><strong>Security:</strong> To protect against fraud, unauthorized access, and other security threats</li>
              <li><strong>Legal Compliance:</strong> To comply with applicable laws and regulations</li>
            </ul>
          </CardContent>
        </Card>

        {/* Data Storage and Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Data Storage and Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
            <p>
              We implement industry-standard security measures to protect your personal information:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Encryption of sensitive data in transit and at rest</li>
              <li>Secure storage of OAuth tokens and credentials</li>
              <li>Regular security audits and updates</li>
              <li>Access controls and authentication mechanisms</li>
              <li>Secure hosting infrastructure (Vercel, cloud providers)</li>
            </ul>
            <p className="mt-4">
              However, no method of transmission over the Internet or electronic storage is 100% secure. 
              While we strive to use commercially acceptable means to protect your information, we cannot 
              guarantee absolute security.
            </p>
          </CardContent>
        </Card>

        {/* Third-Party Services */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Third-Party Services
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
            <p>
              Our service integrates with third-party marketplaces and services:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Marketplace Platforms:</strong> eBay, Facebook Marketplace, Mercari, Poshmark, and others</li>
              <li><strong>Hosting Services:</strong> Vercel and other cloud infrastructure providers</li>
              <li><strong>Analytics:</strong> Usage analytics and performance monitoring tools</li>
            </ul>
            <p className="mt-4">
              These third parties have their own privacy policies. We encourage you to review their 
              privacy policies to understand how they handle your information. We are not responsible 
              for the privacy practices of third-party services.
            </p>
          </CardContent>
        </Card>

        {/* Your Rights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Your Rights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
            <p>You have the following rights regarding your personal information:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Access:</strong> Request access to your personal data</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data</li>
              <li><strong>Portability:</strong> Request transfer of your data to another service</li>
              <li><strong>Objection:</strong> Object to processing of your personal data</li>
              <li><strong>Withdrawal:</strong> Withdraw consent for data processing</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, please contact us using the information provided in the 
              "Contact Us" section below.
            </p>
          </CardContent>
        </Card>

        {/* Cookies and Tracking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Cookies and Tracking Technologies
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
            <p>
              We use cookies and similar tracking technologies to track activity on our service and 
              hold certain information. Cookies are files with a small amount of data that may include 
              an anonymous unique identifier.
            </p>
            <p>
              You can instruct your browser to refuse all cookies or to indicate when a cookie is 
              being sent. However, if you do not accept cookies, you may not be able to use some 
              portions of our service.
            </p>
          </CardContent>
        </Card>

        {/* Data Retention */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Data Retention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
            <p>
              We will retain your personal information only for as long as necessary to fulfill the 
              purposes outlined in this Privacy Policy, unless a longer retention period is required 
              or permitted by law.
            </p>
            <p>
              When you delete your account, we will delete or anonymize your personal information, 
              except where we are required to retain it for legal or regulatory purposes.
            </p>
          </CardContent>
        </Card>

        {/* Children's Privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Children's Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
            <p>
              Our service is not intended for children under the age of 13. We do not knowingly collect 
              personal information from children under 13. If you are a parent or guardian and believe 
              your child has provided us with personal information, please contact us immediately.
            </p>
            <p>
              If we become aware that we have collected personal information from a child under 13 without 
              verification of parental consent, we will take steps to remove that information from our servers.
            </p>
          </CardContent>
        </Card>

        {/* Changes to This Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Changes to This Privacy Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by 
              posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
            <p>
              You are advised to review this Privacy Policy periodically for any changes. Changes to this 
              Privacy Policy are effective when they are posted on this page.
            </p>
          </CardContent>
        </Card>

        {/* Contact Us */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Contact Us
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-gray-700 dark:text-gray-300">
            <p>
              If you have any questions about this Privacy Policy or wish to exercise your rights, 
              please contact us:
            </p>
            <div className="bg-muted p-4 rounded-lg">
              <p className="font-semibold mb-2">ProfitPulse Privacy Team</p>
              <p>Email: privacy@profitpulse.com</p>
              <p className="mt-2 text-sm text-muted-foreground">
                We will respond to your inquiry within 30 days.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer Note */}
      <div className="mt-8 p-4 bg-muted rounded-lg text-center text-sm text-gray-600 dark:text-gray-400">
        <p>
          This Privacy Policy is effective as of {lastUpdated} and applies to all users of ProfitPulse.
        </p>
      </div>
    </div>
  );
}

