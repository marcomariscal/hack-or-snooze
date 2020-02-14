$(async function() {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $favoritedArticles = $("#favorited-articles");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $navWelcome = $("#nav-welcome");
  const $navUserProfile = $("#nav-user-profile");
  const $userProfile = $("#user-profile");
  const $mainNavLinks = $(".main-nav-links");
  const $body = $("body");
  const $nav = $("nav");

  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   * If successful, we will set up the user instance
   */

  $loginForm.on("submit", loginFormSubmit);

  /**
   * Event listener for signing up/creating account.
   * If successful, we will setup a new user instance
   */

  $createAccountForm.on("submit", createAccount);

  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", logout);

  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", () => {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

  /**
   * Event handler for Navigation to Homepage
   */

  $nav.on("click", "#nav-all", async () => {
    hideElements();
    await generateStories();
    $allStoriesList.show();
    highlightFavorites();
  });

  /**
   * Event handler for nav bar submit click
   */

  $nav.on("click", "#nav-submit", () => $submitForm.slideToggle());

  /**
   * Event handler for nav bar submit click
   */

  $nav.on("click", "#nav-favorites", () => {
    hideElements();
    $favoritedArticles.show();
    generateFavorites();
  });

  /**
   * Event handler for stories nav bar click
   */

  $nav.on("click", "#nav-my-stories", () => {
    hideElements();
    $ownStories.show();
    generateOwnStories();
    generateFavorites();
  });

  /**
   * Event handler for user profile nav bar click
   */

  $nav.on("click", "#nav-user-profile", generateUserProfile);

  /**
   * Event handler for favorite icon click and adding favorite
   */

  $body.on("click", ".fa-star.far", addFavorite);

  /**
   * Event handler for favorite icon click when removing favorite
   */

  $body.on("click", ".fa-star.fas", removeFavorite);

  /**
   * Event handler for trash can icon click and removing story
   */

  $body.on("click", ".fas.fa-trash-alt", removeStory);

  async function removeStory() {
    const $trashCan = $(this);
    const storyId = $trashCan.parent().parent()[0].id;
    const removedStory = await currentUser.removeUserStory(storyId);

    const filtered = currentUser.ownStories.filter(s => {
      return s.storyId !== removedStory.storyId;
    });

    currentUser.ownStories = filtered;

    generateOwnStories();
    highlightFavorites();
  }

  /**
   * Populate user profile section
   */

  function generateUserProfile() {
    hideElements();

    const name = currentUser.name;
    const username = currentUser.username;
    let createdAt = currentUser.createdAt;
    createdAt = createdAt.slice(0, createdAt.indexOf("T"));

    $("#profile-name").text(`Name: ${name}`);
    $("#profile-username").text(`Username: ${username}`);
    $("#profile-account-date").text(`Account Created: ${createdAt}`);

    $userProfile.show();
  }

  async function generateOwnStories() {
    $ownStories.empty();

    if (currentUser.ownStories.length === 0) {
      const msg = "<h5>No stories added by user yet!</h5>";
      $ownStories.append(msg);
    }

    for (let story of currentUser.ownStories) {
      let result = generateStoryHTML(story);
      $ownStories.append(result);
    }
    const trashCan = ` <span class="trash-can">
          <i class="fas fa-trash-alt"></i> 
        </span`;

    $("#my-articles li").each(function() {
      $(this).prepend(trashCan);
    });

    highlightFavorites();
  }

  /**
   * Event handler for submitting a new post
   */

  $submitForm.on("submit", async function(evt) {
    evt.preventDefault();

    // grab the author, title, and url from new story submission
    const author = $("#author").val();
    const title = $("#title").val();
    const url = $("#url").val();
    const newStory = { author, title, url };

    // submit to API
    const story = await storyList.addStory(currentUser, newStory);
    await generateStories();
    highlightFavorites();

    // clear inputs and hide submit new story section
    $submitForm.toggle();
    $submitForm.trigger("reset");

    // add story to currentuser's ownStories and regenerate ownStories
    currentUser.ownStories.push(story);
    generateOwnStories();
  });

  function addFavorite() {
    // check if the user is logged in
    if (!currentUser) return;

    const $star = $(this);
    const storyId = $star.parent().parent()[0].id;

    currentUser.addFavorite(storyId);
    generateFavorites();
    $star.removeClass("far").addClass("fas");
  }

  function removeFavorite() {
    const $star = $(this);
    const storyId = $star.parent().parent()[0].id;

    currentUser.removeFavorite(storyId);
    $star.removeClass("fas").addClass("far");
  }

  /**
   * A rendering function for user favorites,
   * which will generate stories from the favorites and render them
   * with the correct class
   */

  function generateFavorites() {
    // empty out that part of the page
    $favoritedArticles.empty();

    if (currentUser.favorites.length === 0) {
      const msg = "<h5>No favorites added!</h5>";
      $favoritedArticles.append(msg);
    }

    // loop through all of our favorites and generate HTML for them
    for (let favorite of currentUser.favorites) {
      const result = generateStoryHTML(favorite);
      $favoritedArticles.append(result);
    }
    highlightFavorites();
  }

  /**
   * use appropriate class to highlight currentuser's favorites
   */
  function highlightFavorites() {
    const favorites = currentUser.favorites.map(s => s.storyId);
    const $articles = $("li").get();
    const $starIcons = $(".star").children();

    $starIcons.each(function() {
      if (
        favorites.indexOf(
          $(this)
            .parent()
            .parent()[0].id
        ) > -1
      ) {
        $(this)
          .removeClass("far")
          .addClass("fas");
      }
    });
  }

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();

    if (currentUser) {
      showNavForLoggedInUser();
      highlightFavorites();
    } else {
      showNavForLoggedOutUser();
    }
    hideElements();
    $allStoriesList.show();
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // hide all elements
    hideElements();

    // show the stories
    $allStoriesList.show();

    // update the navigation bar
    showNavForLoggedInUser();

    // show the user's favorites
    generateFavorites();
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }
  }

  /**
   * A function to render HTML for an individual Story instance
   */

  function generateStoryHTML(story) {
    let hostName = getHostName(story.url);

    // render story markup
    const storyMarkup = $(`
      <li id="${story.storyId}">
        <span class="star">
          <i class="fa-star far"></i> 
        </span>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

    return storyMarkup;
  }

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $favoritedArticles,
      $ownStories,
      $loginForm,
      $createAccountForm,
      $userProfile
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLogOut.show();
    $navWelcome.show();
    $mainNavLinks.show();
    $navUserProfile.text(currentUser.username);
  }

  function showNavForLoggedOutUser() {
    $navLogin.show();
    $navLogOut.hide();
    $navWelcome.hide();
    $mainNavLinks.hide();
  }

  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }

  async function createAccount(evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    // alert the user is the username is already taken if there is an error creating the user
    try {
      const newUser = await User.create(username, password, name);
      currentUser = newUser;
      syncCurrentUserToLocalStorage();
      loginAndSubmitForm();
    } catch (error) {
      alert("Username is already taken!");
    }
  }

  async function loginFormSubmit(evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    try {
      const userInstance = await User.login(username, password);
      // set the global user to the user instance
      currentUser = userInstance;
      syncCurrentUserToLocalStorage();
      loginAndSubmitForm();
    } catch (error) {
      alert("Username or password is invalid!");
    }
  }

  function logout() {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  }
});
