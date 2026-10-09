import {
  useEffect,
  useRef,
  useState,
} from "react";

import "./UserSettings.css";


const API_BASE =
  "http://localhost:8000/api";


function UserSettings({
  section = "profile",
}) {

  /* =========================================================
     PROFILE STATE
     ========================================================= */

  const [profile, setProfile] =
    useState({
      name: "",
      company_name: "",
      email: "",
      phone_number: "",
      city: "",
      gender: "",
      profile_picture: "",
    });


  const [loading, setLoading] =
    useState(true);


  const [saving, setSaving] =
    useState(false);


  const [message, setMessage] =
    useState({
      type: "",
      text: "",
    });


  const fileInputRef =
    useRef(null);


  /* =========================================================
     NOTIFICATION STATE
     ========================================================= */

  const [notifications, setNotifications] =
    useState({
      emailNotifications: true,
      quotationNotifications: true,
      feedbackNotifications: true,
    });


  const [notificationLoading, setNotificationLoading] =
    useState(false);


  const [notificationSaving, setNotificationSaving] =
    useState(false);


  /* =========================================================
     SECURITY STATE
     ========================================================= */

  const [emailForm, setEmailForm] =
    useState({
      currentEmail: "",
      currentPassword: "",
      newEmail: "",
      confirmEmail: "",
    });


  const [passwordForm, setPasswordForm] =
    useState({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });


  const [securityMessage, setSecurityMessage] =
    useState({
      type: "",
      text: "",
    });


  const [emailSaving, setEmailSaving] =
    useState(false);


  const [passwordSaving, setPasswordSaving] =
    useState(false);


  /* =========================================================
     LOAD CURRENT USER
     ========================================================= */

  useEffect(() => {

    const loadProfile = async () => {

      try {

        setLoading(true);

        setMessage({
          type: "",
          text: "",
        });


        const response =
          await fetch(
            `${API_BASE}/auth/me`,
            {
              method: "GET",
              credentials: "include",
            }
          );


        const data =
          await response.json();


        if (
          !response.ok ||
          !data.success ||
          !data.user
        ) {

          throw new Error(
            data.detail ||
            data.message ||
            "Unable to load profile."
          );

        }


        const user =
          data.user;


        setProfile({

          name:
            user.name || "",

          company_name:
            user.company_name || "",

          email:
            user.email || "",

          phone_number:
            user.phone_number || "",

          city:
            user.city || "",

          gender:
            user.gender || "",

          profile_picture:
            user.profile_picture || "",

        });


        /* ---------------------------------------------
           Set current email for Security page
           --------------------------------------------- */

        setEmailForm(
          (previous) => ({
            ...previous,
            currentEmail:
              user.email || "",
          })
        );


      } catch (error) {

        console.error(
          "Profile loading error:",
          error
        );


        setMessage({

          type: "error",

          text:
            error.message ||
            "Unable to load profile.",

        });

      } finally {

        setLoading(false);

      }

    };


    loadProfile();

  }, []);


  /* =========================================================
     LOAD NOTIFICATION PREFERENCES FROM MYSQL
     ========================================================= */

  useEffect(() => {

    const loadNotificationPreferences =
      async () => {

        try {

          setNotificationLoading(true);


          const response =
            await fetch(
              `${API_BASE}/auth/notifications`,
              {
                method: "GET",
                credentials: "include",
              }
            );


          const data =
            await response.json();


          if (
            !response.ok ||
            !data.success ||
            !data.notifications
          ) {

            throw new Error(
              data.detail ||
              data.message ||
              "Unable to load notification preferences."
            );

          }


          const settings =
            data.notifications;


          setNotifications({

            emailNotifications:
              Boolean(
                settings.email_notifications
              ),

            quotationNotifications:
              Boolean(
                settings.quotation_notifications
              ),

            feedbackNotifications:
              Boolean(
                settings.feedback_notifications
              ),

          });


        } catch (error) {

          console.error(
            "Notification preferences loading error:",
            error
          );


          setMessage({

            type: "error",

            text:
              error.message ||
              "Unable to load notification preferences.",

          });

        } finally {

          setNotificationLoading(false);

        }

      };


    loadNotificationPreferences();

  }, []);


  /* =========================================================
     HANDLE PROFILE INPUT
     ========================================================= */

  const handleChange = (
    event
  ) => {

    const {
      name,
      value,
    } = event.target;


    setProfile(
      (previous) => ({
        ...previous,
        [name]: value,
      })
    );


    setMessage({
      type: "",
      text: "",
    });

  };


  /* =========================================================
     PROFILE PICTURE
     ========================================================= */

  const handleProfilePicture =
    (event) => {

      const file =
        event.target.files?.[0];


      if (!file) {
        return;
      }


      if (
        file.size >
        2 * 1024 * 1024
      ) {

        setMessage({

          type: "error",

          text:
            "Profile picture must be smaller than 2 MB.",

        });

        event.target.value = "";

        return;
      }


      if (
        !file.type.startsWith(
          "image/"
        )
      ) {

        setMessage({

          type: "error",

          text:
            "Please select a valid image file.",

        });

        event.target.value = "";

        return;
      }


      // Compress the image before storing it in the database.
      // The users.profile_picture column is a TEXT field, so keeping the
      // payload small prevents MySQL "Data too long" errors on Save.
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = () => {
        const maxDimension = 400;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext("2d");
        if (!context) {
          URL.revokeObjectURL(objectUrl);
          setMessage({
            type: "error",
            text: "Unable to process the selected image.",
          });
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const finishCompression = (quality) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              URL.revokeObjectURL(objectUrl);
              setMessage({
                type: "error",
                text: "Unable to process the selected image.",
              });
              return;
            }

            if (blob.size > 55000 && quality > 0.45) {
              finishCompression(Math.max(0.45, quality - 0.1));
              return;
            }

            const reader = new FileReader();
            reader.onload = () => {
              setProfile((previous) => ({
                ...previous,
                profile_picture: reader.result,
              }));

              setMessage({ type: "", text: "" });
              URL.revokeObjectURL(objectUrl);
            };
            reader.onerror = () => {
              URL.revokeObjectURL(objectUrl);
              setMessage({
                type: "error",
                text: "Unable to read the selected image.",
              });
            };
            reader.readAsDataURL(blob);
          }, "image/jpeg", quality);
        };

        finishCompression(0.8);
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setMessage({
          type: "error",
          text: "Unable to process the selected image.",
        });
      };

      image.src = objectUrl;

    };


  /* =========================================================
     REMOVE PROFILE PICTURE
     ========================================================= */

  const removeProfilePicture = () => {

    setProfile(
      (previous) => ({

        ...previous,

        profile_picture: "",

      })
    );


    if (
      fileInputRef.current
    ) {

      fileInputRef.current.value =
        "";

    }

  };


  /* =========================================================
     UPDATE PROFILE
     ========================================================= */

  const handleSubmit = async (
    event
  ) => {

    event.preventDefault();


    try {

      setSaving(true);

      setMessage({
        type: "",
        text: "",
      });


      const response =
        await fetch(
          `${API_BASE}/auth/profile`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials: "include",

            body:
              JSON.stringify({

                name:
                  profile.name,

                company_name:
                  profile.company_name || null,

                phone_number:
                  profile.phone_number,

                city:
                  profile.city,

                gender:
                  profile.gender,

                profile_picture:
                  profile.profile_picture ||
                  null,

              }),

          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.detail ||
          data.message ||
          "Unable to update profile."
        );

      }


      if (data.user) {

        setProfile({

          name:
            data.user.name || "",

          email:
            data.user.email || "",

          company_name:
            data.user.company_name || "",

          phone_number:
            data.user.phone_number || "",

          city:
            data.user.city || "",

          gender:
            data.user.gender || "",

          profile_picture:
            data.user.profile_picture || "",

        });

      }


      setMessage({

        type: "success",

        text:
          "User profile updated successfully.",

      });


    } catch (error) {

      console.error(
        "Profile update error:",
        error
      );


      setMessage({

        type: "error",

        text:
          error.message ||
          "Unable to update profile.",

      });


    } finally {

      setSaving(false);

    }

  };


  /* =========================================================
     NOTIFICATION TOGGLE
     ========================================================= */

  const handleNotificationToggle =
    (setting) => {

      setNotifications(
        (previous) => {

          const newValue =
            !previous[setting];


          /* ---------------------------------------------
             MASTER SWITCH OFF
             --------------------------------------------- */

          if (
            setting ===
            "emailNotifications" &&
            newValue === false
          ) {

            return {

              emailNotifications:
                false,

              quotationNotifications:
                false,

              feedbackNotifications:
                false,

            };

          }


          /* ---------------------------------------------
             MASTER SWITCH ON
             --------------------------------------------- */

          if (
            setting ===
            "emailNotifications" &&
            newValue === true
          ) {

            return {

              ...previous,

              emailNotifications:
                true,

            };

          }


          /* ---------------------------------------------
             CHILD SETTING
             --------------------------------------------- */

          return {

            ...previous,

            [setting]:
              newValue,

          };

        }
      );


      setMessage({
        type: "",
        text: "",
      });

    };


  /* =========================================================
     SAVE NOTIFICATION SETTINGS TO MYSQL
     ========================================================= */

  const handleNotificationSave =
    async (event) => {

      event.preventDefault();


      try {

        setNotificationSaving(true);

        setMessage({
          type: "",
          text: "",
        });


        const response =
          await fetch(
            `${API_BASE}/auth/notifications`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",
              },

              credentials: "include",

              body:
                JSON.stringify({

                  email_notifications:
                    notifications.emailNotifications,

                  quotation_notifications:
                    notifications.quotationNotifications,

                  feedback_notifications:
                    notifications.feedbackNotifications,

                }),

            }
          );


        const data =
          await response.json();


        if (!response.ok) {

          throw new Error(
            data.detail ||
            data.message ||
            "Unable to save notification preferences."
          );

        }


        /* ---------------------------------------------
           Update UI from backend response
           --------------------------------------------- */

        if (
          data.notifications
        ) {

          setNotifications({

            emailNotifications:
              Boolean(
                data.notifications.email_notifications
              ),

            quotationNotifications:
              Boolean(
                data.notifications.quotation_notifications
              ),

            feedbackNotifications:
              Boolean(
                data.notifications.feedback_notifications
              ),

          });

        }


        setMessage({

          type: "success",

          text:
            "Notification preferences updated successfully.",

        });


      } catch (error) {

        console.error(
          "Notification saving error:",
          error
        );


        setMessage({

          type: "error",

          text:
            error.message ||
            "Unable to save notification preferences.",

        });


      } finally {

        setNotificationSaving(false);

      }

    };


  /* =========================================================
     EMAIL FORM INPUT
     ========================================================= */

  const handleEmailChange =
    (event) => {

      const {
        name,
        value,
      } = event.target;


      setEmailForm(
        (previous) => ({

          ...previous,

          [name]:
            value,

        })
      );


      setSecurityMessage({
        type: "",
        text: "",
      });

    };


  /* =========================================================
     PASSWORD FORM INPUT
     ========================================================= */

  const handlePasswordChange =
    (event) => {

      const {
        name,
        value,
      } = event.target;


      setPasswordForm(
        (previous) => ({

          ...previous,

          [name]:
            value,

        })
      );


      setSecurityMessage({
        type: "",
        text: "",
      });

    };


  /* =========================================================
     UPDATE CUSTOMER EMAIL
     ========================================================= */

  const handleEmailUpdate =
    async (event) => {

      event.preventDefault();


      setSecurityMessage({
        type: "",
        text: "",
      });


      const {
        currentEmail,
        currentPassword,
        newEmail,
        confirmEmail,
      } = emailForm;


      /* ---------------------------------------------
         VALIDATION
         --------------------------------------------- */

      if (!currentEmail) {

        setSecurityMessage({

          type: "error",

          text:
            "Current email address is required.",

        });

        return;

      }


      if (!currentPassword) {

        setSecurityMessage({

          type: "error",

          text:
            "Current password is required.",

        });

        return;

      }


      if (!newEmail) {

        setSecurityMessage({

          type: "error",

          text:
            "Please enter a new email address.",

        });

        return;

      }


      if (
        newEmail !==
        confirmEmail
      ) {

        setSecurityMessage({

          type: "error",

          text:
            "New email and confirmation email do not match.",

        });

        return;

      }


      if (
        currentEmail.toLowerCase() ===
        newEmail.toLowerCase()
      ) {

        setSecurityMessage({

          type: "error",

          text:
            "New email must be different from the current email.",

        });

        return;

      }


      try {

        setEmailSaving(true);


        const response =
          await fetch(
            `${API_BASE}/auth/change-email`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",
              },

              credentials: "include",

              body:
                JSON.stringify({

                  current_email:
                    currentEmail,

                  current_password:
                    currentPassword,

                  new_email:
                    newEmail,

                }),

            }
          );


        const data =
          await response.json();


        if (!response.ok) {

          throw new Error(
            data.detail ||
            data.message ||
            "Unable to update email address."
          );

        }


        const updatedEmail =
          data.email ||
          newEmail;


        /* ---------------------------------------------
           Update profile email in UI
           --------------------------------------------- */

        setProfile(
          (previous) => ({

            ...previous,

            email:
              updatedEmail,

          })
        );


        /* ---------------------------------------------
           Reset email form
           --------------------------------------------- */

        setEmailForm({

          currentEmail:
            updatedEmail,

          currentPassword:
            "",

          newEmail:
            "",

          confirmEmail:
            "",

        });


        setSecurityMessage({

          type: "success",

          text:
            data.message ||
            "Email address updated successfully.",

        });


      } catch (error) {

        console.error(
          "Customer email update error:",
          error
        );


        setSecurityMessage({

          type: "error",

          text:
            error.message ||
            "Unable to update email address.",

        });

      } finally {

        setEmailSaving(false);

      }

    };


  /* =========================================================
     UPDATE CUSTOMER PASSWORD
     ========================================================= */

  const handlePasswordUpdate =
    async (event) => {

      event.preventDefault();


      setSecurityMessage({
        type: "",
        text: "",
      });


      const {
        currentPassword,
        newPassword,
        confirmPassword,
      } = passwordForm;


      /* ---------------------------------------------
         VALIDATION
         --------------------------------------------- */

      if (!currentPassword) {

        setSecurityMessage({

          type: "error",

          text:
            "Current password is required.",

        });

        return;

      }


      if (!newPassword) {

        setSecurityMessage({

          type: "error",

          text:
            "Please enter a new password.",

        });

        return;

      }


      if (
        newPassword.length <
        8
      ) {

        setSecurityMessage({

          type: "error",

          text:
            "New password must contain at least 8 characters.",

        });

        return;

      }


      if (
        newPassword !==
        confirmPassword
      ) {

        setSecurityMessage({

          type: "error",

          text:
            "New password and confirmation password do not match.",

        });

        return;

      }


      if (
        currentPassword ===
        newPassword
      ) {

        setSecurityMessage({

          type: "error",

          text:
            "New password must be different from the current password.",

        });

        return;

      }


      try {

        setPasswordSaving(true);


        const response =
          await fetch(
            `${API_BASE}/auth/change-password`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",
              },

              credentials: "include",

              body:
                JSON.stringify({

                  current_password:
                    currentPassword,

                  new_password:
                    newPassword,

                }),

            }
          );


        const data =
          await response.json();


        if (!response.ok) {

          throw new Error(
            data.detail ||
            data.message ||
            "Unable to update password."
          );

        }


        /* ---------------------------------------------
           Clear password fields
           --------------------------------------------- */

        setPasswordForm({

          currentPassword:
            "",

          newPassword:
            "",

          confirmPassword:
            "",

        });


        setSecurityMessage({

          type: "success",

          text:
            data.message ||
            "Password updated successfully.",

        });


      } catch (error) {

        console.error(
          "Customer password update error:",
          error
        );


        setSecurityMessage({

          type: "error",

          text:
            error.message ||
            "Unable to update password.",

        });

      } finally {

        setPasswordSaving(false);

      }

    };


  /* =========================================================
     SECTION INFORMATION
     ========================================================= */

  const sectionInfo = {

    profile: {

      eyebrow:
        "ACCOUNT SETTINGS",

      title:
        "Profile",

      description:
        "Manage your basic personal information and profile picture.",

    },

    notifications: {

      eyebrow:
        "ACCOUNT SETTINGS",

      title:
        "Notifications",

      description:
        "Manage your email notification preferences.",

    },

    security: {

      eyebrow:
        "ACCOUNT SETTINGS",

      title:
        "Security",

      description:
        "Manage your account email and password.",

    },

    about: {

      eyebrow:
        "SYSTEM INFORMATION",

      title:
        "About",

      description:
        "Information about the maritime freight system.",

    },

  };


  const currentSection =
    sectionInfo[section] ||
    sectionInfo.profile;


  /* =========================================================
     PROFILE CONTENT
     ========================================================= */

  const renderProfile =
    () => (

      <>

        {message.text && (

          <div
            className={`user-settings-message ${
              message.type === "success"
                ? "user-settings-message-success"
                : "user-settings-message-error"
            }`}
          >
            {message.text}
          </div>

        )}


        {loading ? (

          <div className="user-settings-loading">

            Loading profile...

          </div>

        ) : (

          <form
            className="user-profile-form"
            onSubmit={
              handleSubmit
            }
          >

            {/* PROFILE PICTURE */}

            <div className="user-profile-picture-card">

              <div className="user-profile-picture-wrapper">

                {profile.profile_picture ? (

                  <img
                    src={
                      profile.profile_picture
                    }
                    alt="Profile"
                    className="user-profile-picture"
                  />

                ) : (

                  <div className="user-profile-picture-placeholder">

                    {profile.name
                      ?.charAt(0)
                      .toUpperCase() ||
                      "U"}

                  </div>

                )}

              </div>


              <div className="user-profile-picture-info">

                <h3>
                  Profile Picture
                </h3>

                <p>
                  Add a profile picture
                  to personalize your account.
                </p>


                <div className="profile-picture-actions">

                  <button
                    type="button"
                    className="profile-upload-button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                  >
                    Choose Picture
                  </button>


                  {profile.profile_picture && (

                    <button
                      type="button"
                      className="profile-remove-button"
                      onClick={
                        removeProfilePicture
                      }
                    >
                      Remove
                    </button>

                  )}

                </div>


                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={
                    handleProfilePicture
                  }
                  hidden
                />


                <small>
                  JPG, PNG or other image
                  formats · Maximum 2 MB
                </small>

              </div>

            </div>


            {/* BASIC INFORMATION */}

            <div className="user-settings-card">

              <div className="user-settings-card-header">

                <h2>
                  Basic Information
                </h2>

                <p>
                  Update the information
                  associated with your account.
                </p>

              </div>


              <div className="user-profile-grid">

                <div className="user-settings-field">

                  <label>
                    Name
                  </label>

                  <input
                    type="text"
                    name="name"
                    value={
                      profile.name
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Enter your name"
                    required
                  />

                </div>


                <div className="user-settings-field">

                  <label>
                    Company
                  </label>

                  <input
                    type="text"
                    name="company_name"
                    value={profile.company_name}
                    onChange={handleChange}
                    placeholder="Enter company name"
                  />

                </div>


                <div className="user-settings-field">

                  <label>
                    Email
                  </label>

                  <input
                    type="email"
                    value={
                      profile.email
                    }
                    disabled
                  />

                  <small>
                    Email can be changed
                    from Security settings.
                  </small>

                </div>


                <div className="user-settings-field">

                  <label>
                    Phone Number
                  </label>

                  <input
                    type="tel"
                    name="phone_number"
                    value={
                      profile.phone_number
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Enter phone number"
                  />

                </div>


                <div className="user-settings-field">

                  <label>
                    City / Place
                  </label>

                  <input
                    type="text"
                    name="city"
                    value={
                      profile.city
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Enter your city or place"
                  />

                </div>


                <div className="user-settings-field">

                  <label>
                    Gender
                  </label>

                  <select
                    name="gender"
                    value={
                      profile.gender
                    }
                    onChange={
                      handleChange
                    }
                  >

                    <option value="">
                      Select gender
                    </option>

                    <option value="Male">
                      Male
                    </option>

                    <option value="Female">
                      Female
                    </option>

                    <option value="Other">
                      Other
                    </option>

                    <option value="Prefer not to say">
                      Prefer not to say
                    </option>

                  </select>

                </div>

              </div>


              <div className="user-profile-save-row">

                <button
                  type="submit"
                  className="user-settings-primary-button"
                  disabled={saving}
                >

                  {saving
                    ? "Updating..."
                    : "Update User Profile"}

                </button>

              </div>

            </div>

          </form>

        )}

      </>

    );


  /* =========================================================
     NOTIFICATIONS CONTENT
     ========================================================= */

  const renderNotifications =
    () => (

      <>

        {message.text && (

          <div
            className={`user-settings-message ${
              message.type === "success"
                ? "user-settings-message-success"
                : "user-settings-message-error"
            }`}
          >
            {message.text}
          </div>

        )}


        {notificationLoading ? (

          <div className="user-settings-loading">

            Loading notification preferences...

          </div>

        ) : (

          <form
            className="user-settings-form"
            onSubmit={
              handleNotificationSave
            }
          >

            <div className="user-settings-card">

              <div className="user-settings-card-header">

                <h2>
                  Email Notifications
                </h2>

                <p>
                  Control whether you receive
                  account-related email notifications.
                </p>

              </div>


              {/* EMAIL NOTIFICATIONS */}

              <div className="notification-setting-row">

                <div className="notification-setting-info">

                  <h3>
                    Email Notifications
                  </h3>

                  <p>
                    Receive important account emails
                    such as successful registration,
                    OTP delivery and successful login.
                  </p>

                </div>


                <button
                  type="button"
                  className={`notification-toggle ${
                    notifications.emailNotifications
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    handleNotificationToggle(
                      "emailNotifications"
                    )
                  }
                  aria-label="Toggle email notifications"
                  aria-pressed={
                    notifications.emailNotifications
                  }
                >

                  <span className="notification-toggle-knob" />

                </button>

              </div>


              {/* QUOTATION NOTIFICATIONS */}

              <div
                className={`notification-setting-row ${
                  !notifications.emailNotifications
                    ? "notification-setting-disabled"
                    : ""
                }`}
              >

                <div className="notification-setting-info">

                  <h3>
                    Quotation Notifications
                  </h3>

                  <p>
                    Receive email notifications when
                    your quotation is approved or rejected.
                  </p>

                </div>


                <button
                  type="button"
                  className={`notification-toggle ${
                    notifications.quotationNotifications &&
                    notifications.emailNotifications
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    notifications.emailNotifications &&
                    handleNotificationToggle(
                      "quotationNotifications"
                    )
                  }
                  disabled={
                    !notifications.emailNotifications
                  }
                  aria-label="Toggle quotation notifications"
                  aria-pressed={
                    notifications.quotationNotifications
                  }
                >

                  <span className="notification-toggle-knob" />

                </button>

              </div>


              {/* FEEDBACK NOTIFICATIONS */}

              <div
                className={`notification-setting-row ${
                  !notifications.emailNotifications
                    ? "notification-setting-disabled"
                    : ""
                }`}
              >

                <div className="notification-setting-info">

                  <h3>
                    Feedback Notifications
                  </h3>

                  <p>
                    Receive email notifications related
                    to feedback and feedback responses.
                  </p>

                </div>


                <button
                  type="button"
                  className={`notification-toggle ${
                    notifications.feedbackNotifications &&
                    notifications.emailNotifications
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    notifications.emailNotifications &&
                    handleNotificationToggle(
                      "feedbackNotifications"
                    )
                  }
                  disabled={
                    !notifications.emailNotifications
                  }
                  aria-label="Toggle feedback notifications"
                  aria-pressed={
                    notifications.feedbackNotifications
                  }
                >

                  <span className="notification-toggle-knob" />

                </button>

              </div>


              {/* SAVE */}

              <div className="user-settings-save-row">

                <button
                  type="submit"
                  className="user-settings-primary-button"
                  disabled={
                    notificationSaving
                  }
                >

                  {notificationSaving
                    ? "Saving..."
                    : "Save Changes"}

                </button>

              </div>

            </div>

          </form>

        )}

      </>

    );


  /* =========================================================
     SECURITY CONTENT
     ========================================================= */

  const renderSecurity =
    () => (

      <>

        {securityMessage.text && (

          <div
            className={`user-settings-message ${
              securityMessage.type === "success"
                ? "user-settings-message-success"
                : "user-settings-message-error"
            }`}
          >
            {securityMessage.text}
          </div>

        )}


        {/* =====================================================
            CHANGE EMAIL
            ===================================================== */}

        <form
          className="user-settings-form"
          onSubmit={
            handleEmailUpdate
          }
        >

          <div className="user-settings-card">

            <div className="user-settings-card-header">

              <h2>
                Change Email Address
              </h2>

              <p>
                Update the email address associated
                with your account.
              </p>

            </div>


            <div className="user-security-grid">

              {/* CURRENT EMAIL */}

              <div className="user-settings-field">

                <label>
                  Current / Old Email
                </label>

                <input
                  type="email"
                  name="currentEmail"
                  value={
                    emailForm.currentEmail
                  }
                  onChange={
                    handleEmailChange
                  }
                  placeholder="Enter current email"
                  required
                />

              </div>


              {/* CURRENT PASSWORD */}

              <div className="user-settings-field">

                <label>
                  Current Password
                </label>

                <input
                  type="password"
                  name="currentPassword"
                  value={
                    emailForm.currentPassword
                  }
                  onChange={
                    handleEmailChange
                  }
                  placeholder="Enter current password"
                  required
                />

              </div>


              {/* NEW EMAIL */}

              <div className="user-settings-field">

                <label>
                  New Email
                </label>

                <input
                  type="email"
                  name="newEmail"
                  value={
                    emailForm.newEmail
                  }
                  onChange={
                    handleEmailChange
                  }
                  placeholder="Enter new email"
                  required
                />

              </div>


              {/* CONFIRM EMAIL */}

              <div className="user-settings-field">

                <label>
                  Confirm New Email
                </label>

                <input
                  type="email"
                  name="confirmEmail"
                  value={
                    emailForm.confirmEmail
                  }
                  onChange={
                    handleEmailChange
                  }
                  placeholder="Confirm new email"
                  required
                />

              </div>

            </div>


            <div className="user-settings-save-row">

              <button
                type="submit"
                className="user-settings-primary-button"
                disabled={
                  emailSaving
                }
              >

                {emailSaving
                  ? "Updating..."
                  : "Update Email"}

              </button>

            </div>

          </div>

        </form>


        {/* =====================================================
            CHANGE PASSWORD
            ===================================================== */}

        <form
          className="user-settings-form"
          onSubmit={
            handlePasswordUpdate
          }
        >

          <div className="user-settings-card">

            <div className="user-settings-card-header">

              <h2>
                Change Password
              </h2>

              <p>
                Update your account password
                to keep your account secure.
              </p>

            </div>


            <div className="user-security-grid">

              {/* CURRENT PASSWORD */}

              <div className="user-settings-field">

                <label>
                  Current Password
                </label>

                <input
                  type="password"
                  name="currentPassword"
                  value={
                    passwordForm.currentPassword
                  }
                  onChange={
                    handlePasswordChange
                  }
                  placeholder="Enter current password"
                  required
                />

              </div>


              {/* NEW PASSWORD */}

              <div className="user-settings-field">

                <label>
                  New Password
                </label>

                <input
                  type="password"
                  name="newPassword"
                  value={
                    passwordForm.newPassword
                  }
                  onChange={
                    handlePasswordChange
                  }
                  placeholder="Enter new password"
                  required
                />

                <small>
                  Password must contain at least
                  8 characters.
                </small>

              </div>


              {/* CONFIRM PASSWORD */}

              <div className="user-settings-field">

                <label>
                  Confirm New Password
                </label>

                <input
                  type="password"
                  name="confirmPassword"
                  value={
                    passwordForm.confirmPassword
                  }
                  onChange={
                    handlePasswordChange
                  }
                  placeholder="Confirm new password"
                  required
                />

              </div>

            </div>


            <div className="user-settings-save-row">

              <button
                type="submit"
                className="user-settings-primary-button"
                disabled={
                  passwordSaving
                }
              >

                {passwordSaving
                  ? "Updating..."
                  : "Update Password"}

              </button>

            </div>

          </div>

        </form>

      </>

    );


  /* =========================================================
     ABOUT CONTENT
     ========================================================= */

  const renderAbout =
    () => (

      <>

        <div className="user-settings-card about-system-card">

          <div className="about-system-icon">
            ⚓
          </div>


          <div className="user-settings-card-header">

            <h2>
              Agentic AI for Maritime Freight
            </h2>

            <p>
              Maritime Freight Pricing and
              Route Optimization System
            </p>

          </div>


          <div className="about-system-description">

            <p>
              This platform uses Agentic AI to
              support maritime freight analysis,
              route comparison, pricing evaluation,
              weather intelligence and customs
              validation.
            </p>

            <p>
              The system helps users compare
              available shipping routes and generate
              informed freight quotations based on
              multiple operational factors.
            </p>

          </div>

        </div>


        {/* =====================================================
            SYSTEM INFORMATION
            ===================================================== */}

        <div className="user-settings-card">

          <div className="user-settings-card-header">

            <h2>
              System Information
            </h2>

            <p>
              Current application information.
            </p>

          </div>


          <div className="about-information-grid">

            <div className="about-information-item">

              <span>
                Application
              </span>

              <strong>
                Agentic Maritime Brokerage
              </strong>

            </div>


            <div className="about-information-item">

              <span>
                System Version
              </span>

              <strong>
                Version 1.0.0
              </strong>

            </div>


            <div className="about-information-item">

              <span>
                Route Intelligence
              </span>

              <strong>
                Enabled
              </strong>

            </div>


            <div className="about-information-item">

              <span>
                Pricing Intelligence
              </span>

              <strong>
                Enabled
              </strong>

            </div>


            <div className="about-information-item">

              <span>
                Weather Intelligence
              </span>

              <strong>
                Enabled
              </strong>

            </div>


            <div className="about-information-item">

              <span>
                Customs Validation
              </span>

              <strong>
                Enabled
              </strong>

            </div>

          </div>

        </div>


        {/* =====================================================
            TERMS & CONDITIONS
            ===================================================== */}

        <div className="user-settings-card">

          <div className="user-settings-card-header">

            <h2>
              Terms & Conditions
            </h2>

            <p>
              Important information about using
              the maritime freight platform.
            </p>

          </div>


          <div className="about-text-section">

            <p>
              The information provided by this
              system is intended to support freight
              planning and quotation decisions.
              Users should verify operational,
              commercial and regulatory requirements
              before making final shipping decisions.
            </p>

            <p>
              Route recommendations, pricing
              information, weather information and
              customs validation are generated from
              the data available to the system and
              may change based on updated information.
            </p>

          </div>

        </div>


        {/* =====================================================
            HELP
            ===================================================== */}

        <div className="user-settings-card">

          <div className="user-settings-card-header">

            <h2>
              Help & Support
            </h2>

            <p>
              Need assistance while using the system?
            </p>

          </div>


          <div className="about-help-list">

            <div className="about-help-item">

              <span className="about-help-icon">
                1
              </span>

              <div>

                <h3>
                  Route Analysis
                </h3>

                <p>
                  Enter your origin, destination,
                  cargo type and container quantity
                  to analyze available routes.
                </p>

              </div>

            </div>


            <div className="about-help-item">

              <span className="about-help-icon">
                2
              </span>

              <div>

                <h3>
                  Quotation
                </h3>

                <p>
                  Review the route and pricing
                  analysis before saving or requesting
                  approval for a quotation.
                </p>

              </div>

            </div>


            <div className="about-help-item">

              <span className="about-help-icon">
                3
              </span>

              <div>

                <h3>
                  Account Settings
                </h3>

                <p>
                  Use Profile, Notifications and
                  Security settings to manage your
                  account information.
                </p>

              </div>

            </div>

          </div>

        </div>

      </>

    );


  /* =========================================================
     MAIN RENDER
     ========================================================= */

  return (

    <div className="user-settings-page">

      <div className="user-settings-content">

        {/* ===================================================
            HEADER
            =================================================== */}

        <div className="user-settings-header">

          <div>

            <span className="user-settings-eyebrow">
              {currentSection.eyebrow}
            </span>

            <h1>
              {currentSection.title}
            </h1>

            <p>
              {currentSection.description}
            </p>

          </div>

        </div>


        {/* ===================================================
            SECTION CONTENT
            =================================================== */}

        {section === "profile" &&
          renderProfile()}


        {section === "notifications" &&
          renderNotifications()}


        {section === "security" &&
          renderSecurity()}


        {section === "about" &&
          renderAbout()}

      </div>

    </div>

  );

}


export default UserSettings;